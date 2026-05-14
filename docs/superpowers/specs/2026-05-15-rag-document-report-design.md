# RAG Document-Report Feature Design

> Spec date: 2026-05-15
> Status: Proposal — not yet implemented
> Author: agent/1
> Audience: project owner deciding tech stack + integration shape

## TL;DR

The user wants: upload PDF / Word / TXT, tick a "**only retrieve from these docs**" checkbox, then have the system write a **deep report**.

This is a classic **RAG (Retrieval-Augmented Generation) pipeline** with one twist: an explicit **closed-book switch** that forces grounding strictly to user-provided documents.

The current MAW codebase has **none of this infrastructure** — MAW is a multi-agent dashboard, not a document QA system. This spec proposes a self-contained `rag/` module that plugs into MAW's existing FastAPI server and React frontend, plus the new dependencies, data model, and API surface.

---

## 1. Current Project Audit

| Layer | Stack today | RAG-ready? |
|-------|-------------|------------|
| Backend | Python 3.10+ / FastAPI 0.109+ / uvicorn / sse-starlette | Yes — FastAPI is a clean home for upload + retrieve endpoints; SSE already wired for live streaming |
| Frontend | React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + Radix UI + lucide-react | Yes — modern enough; needs new upload + report UI |
| Storage | `state.json` flat file under `.maw/` | No — need vector store + document blob store |
| Agents | Subprocess `claude` CLI in git worktrees, dispatched by `auto_dispatcher.py` | Reusable — a report-writing agent can be a normal MAW agent if we want long-running offline runs, but the live "ask + report" interactive flow is better served by a direct API call to Anthropic SDK |
| Document parsing | None | Missing |
| Embedding / vector DB | None | Missing |
| Reranker | None | Missing |
| LLM client SDK | None (only the `claude` CLI subprocess) | Missing — add `anthropic` SDK for direct API calls |

**Conclusion:** MAW's plumbing (FastAPI, SSE, state.json, React + Tailwind) is reusable. The RAG layer itself — parsers, chunker, embedder, vector store, reranker, prompt orchestrator — is all new.

---

## 2. Use Cases

1. **Closed-book deep report** (the explicit ask)
   - User uploads 3-20 source docs (PDF, .docx, .txt, .md).
   - User checks "**仅检索上传文档**".
   - User types a topic ("Q3 市场竞争格局深度分析").
   - System: parses → chunks → embeds → indexes → retrieves → reranks → multi-section synthesis → returns a long Markdown report with inline citations `[doc.pdf, p.4]`.

2. **Open-book deep report** (checkbox off)
   - Same flow, but the model may also use its parametric knowledge for background context. The prompt explicitly labels which sentences came from retrieved context vs. model knowledge.

3. **Q&A over uploaded docs** (free side-effect)
   - Same retrieval substrate answers ad-hoc questions in chat form. Cheap to expose once the index exists.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                  │
│  ├── UploadDropzone   ── POST /api/rag/upload (multipart)         │
│  ├── DocList          ── GET  /api/rag/sessions/{sid}/docs (SSE)  │
│  ├── ReportForm       ── { sid, query, docs_only } ──┐            │
│  └── ReportViewer     ←─ SSE stream of tokens   ─────┘            │
└──────────────────────────────────────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI (lib/rag/*)                                              │
│                                                                   │
│  Upload pipeline (background task):                               │
│    file ─► parser ─► chunker ─► embedder ─► Qdrant insert         │
│                                                                   │
│  Query pipeline (SSE response):                                   │
│    query ─► query_planner (Claude) ─► sub-questions               │
│            └─► hybrid_retrieve (dense + BM25, filter by sid)      │
│            └─► reranker (bge-reranker)                            │
│            └─► context window builder                             │
│            └─► report_writer (Claude, streaming)  ─► SSE chunks   │
└──────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
┌──────────────────┐                ┌──────────────────────────────┐
│ Blob store        │                │ Vector store (Qdrant local)  │
│ .maw/rag/<sid>/   │                │ .maw/rag/qdrant/             │
│   uploads/        │                │ collection: docs             │
│   parsed/ (json)  │                │   payload: sid, doc_id,      │
│                   │                │            page, chunk_idx   │
└──────────────────┘                └──────────────────────────────┘
```

### 3.1 Data flow — upload

```
1. POST /api/rag/upload (multipart, ?session_id=<sid>)
2. Save raw bytes  → .maw/rag/<sid>/uploads/<doc_id>.<ext>
3. Append row     → .maw/rag/sessions.json  (sid, doc_id, name, status=parsing)
4. Spawn background task:
   a. Parse: dispatch by mime/extension
        .pdf  → unstructured or pypdf+pdfplumber (text) +  paddleocr (scanned fallback)
        .docx → python-docx or mammoth
        .doc  → libreoffice --headless --convert-to docx  (one-shot)
        .txt  → read with chardet for encoding
        .md   → read as-is
   b. Normalize → list[ParsedBlock]  { text, page, section_path }
   c. Chunk: RecursiveCharacterTextSplitter (paragraph→sentence)
        chunk_size=512 tokens, overlap=64
        plus parent-chunk (2048 tokens) for expansion at retrieval
   d. Embed: BAAI/bge-m3 (multilingual, supports zh) via sentence-transformers
        OR Voyage AI voyage-3-large if cloud is acceptable
   e. Upsert Qdrant: each child chunk = 1 point
        payload = { sid, doc_id, doc_name, page, parent_id, text }
   f. Update sessions.json status=ready
   g. SSE event so frontend updates the doc list
```

### 3.2 Data flow — query (closed-book mode)

```
1. POST /api/rag/query  body = { sid, query, docs_only: true, mode: "deep_report" }
2. Plan: Claude Haiku decomposes the topic into 3-8 sub-questions.
   Example: "Q3 市场竞争格局深度分析" →
     - 主要竞争对手 / 市场份额 / 产品对比 / 价格策略 / 未来展望
3. For each sub-question:
   a. Embed the sub-question (bge-m3).
   b. Dense search Qdrant (top_k=20, filter = sid == <sid>)
   c. Sparse search via in-memory BM25 over the same session corpus (top_k=20)
   d. RRF merge to top_k=20 candidates
   e. Rerank with bge-reranker-v2-m3 to top_k=5
4. Aggregate: dedupe by parent_id, expand each kept chunk to its parent.
5. Build context window: pack ~30k tokens of chunks + a citation map.
6. Generate report with Claude Sonnet 4.6:
   - Pass 1 — Outline: "Given this context and topic, produce a 5-8 section outline."
   - Pass 2 — Section drafting (loop, possibly parallel): write each section
     using only its own retrieved sub-context, emit inline citations `[#3]`.
   - Pass 3 — Stitch + edit: smooth transitions, dedupe, finalize references.
7. Stream tokens back via SSE.
```

`docs_only=false` differs only at step 6: the system prompt is relaxed and asks the model to mark unsupported sentences with `[model knowledge]`.

### 3.3 Why this shape

- **Closed-book grounding** is enforced two ways: (a) the retriever's `sid` filter physically prevents foreign context, and (b) the system prompt asserts "if not in the provided context, write `未在上传文档中找到`". Belt-and-suspenders because the prompt alone leaks ~5-10% of the time.
- **Hierarchical chunking** (small for retrieval, parent for context) gives both precision and coherent generation context.
- **Hybrid retrieval (dense + BM25)** matters for Chinese technical reports where named entities and acronyms are common — dense alone misses exact-string lookups.
- **Rerank step** is cheap (single bge-reranker call over 20-40 candidates) and reliably lifts top-5 precision by 10-20 pp.
- **Sub-question decomposition** is what turns a one-shot QA into a "deep report" — each section gets its own retrieval, so coverage scales with topic breadth instead of being capped by a single query's recall.

---

## 4. Tech Stack Recommendation

| Concern | Pick | Why | Alternative |
|---------|------|-----|-------------|
| PDF parsing | `unstructured[pdf]` | Handles layout, tables, images; one API for many formats | `pypdf` + `pdfplumber` (lighter, no OCR) |
| Word parsing | `python-docx` | Stable, pure-Python, well-known | `mammoth` (better HTML fidelity) |
| OCR (scanned PDF fallback) | `paddleocr` | Strong zh + en, runs on CPU | `tesseract` (more setup for zh) |
| Encoding detection | `chardet` | Standard | `charset-normalizer` |
| Text splitting | `langchain-text-splitters` | Mature recursive splitter; no need to take all of LangChain | Hand-rolled regex splitter |
| Embedding model | `BAAI/bge-m3` via `sentence-transformers` | SOTA multilingual incl. zh; supports dense + sparse + colbert from one model; permissive license | Cloud: Voyage `voyage-3-large`; OpenAI `text-embedding-3-large` |
| Vector store | **Qdrant** (local mode, file-backed) | Production-ready, filter-by-payload (critical for `sid` scoping), hybrid search built-in, Python client trivial | `LanceDB` (file-only, simpler); `Chroma` (very simple but weaker filtering); `sqlite-vec` (zero infra, smaller scale) |
| Sparse / BM25 | `rank_bm25` in-memory per session | Tiny corpora (≤a few MB per session); rebuild from session blobs on cold start | Qdrant 1.x sparse vectors (more setup) |
| Reranker | `BAAI/bge-reranker-v2-m3` | Open, strong zh + en, ~600M params runs on CPU acceptably | Cohere Rerank 3.5 (cloud, faster) |
| LLM client | `anthropic` Python SDK + `claude-sonnet-4-6` for writing, `claude-haiku-4-5-20251001` for query planning | Sonnet for quality writing, Haiku for cheap fast decomposition; both support prompt caching (cache the retrieved context for sub-question loop) | OpenAI / Gemini — but stay in the Claude ecosystem to match the rest of MAW |
| Orchestration | Plain Python — no LangChain / LlamaIndex framework | The pipeline is ~300 lines; framework abstractions cost more than they save here | LlamaIndex if the team wants more out-of-the-box patterns |
| Background tasks | FastAPI `BackgroundTasks` for v1; upgrade to `arq` or `rq` (Redis) if concurrent uploads grow | Avoid Celery — too heavy for this | Custom thread pool |

### Why not LangChain / LlamaIndex?

The pipeline has ~6 deterministic stages, all owned by us. Frameworks shine when the user wants to swap components rapidly during prototyping; they hurt when you need to debug a specific behavior in production. Direct calls to `sentence-transformers`, `qdrant_client`, and `anthropic` are short, typed, and grep-able. Skip the framework, take the ~30 useful utilities directly (`langchain-text-splitters`, `rank_bm25`).

### New Python dependencies (additive)

```
# requirements.txt additions
anthropic>=0.40.0
qdrant-client>=1.10.0
sentence-transformers>=3.0.0
unstructured[pdf,docx]>=0.15.0
python-docx>=1.1.0
pypdf>=4.0.0
pdfplumber>=0.11.0
paddleocr>=2.7.0           # heavy; mark optional via extras
langchain-text-splitters>=0.3.0
rank-bm25>=0.2.2
chardet>=5.2.0
python-multipart>=0.0.9    # FastAPI multipart upload
```

Mark `paddleocr` as an optional extra (`requirements-ocr.txt`) — many users won't need OCR and it pulls in PaddlePaddle (large).

### Frontend additions

```
# frontend/package.json additions
react-dropzone     # drag-drop upload
react-markdown     # report rendering
remark-gfm         # tables + task lists in markdown
```

---

## 5. API Surface

All under `/api/rag/*`. Reuses the existing FastAPI app in `lib/server.py`.

| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| POST   | `/api/rag/sessions` | — | `{ session_id }` |
| POST   | `/api/rag/sessions/{sid}/upload` | multipart `files[]` | `{ doc_ids: [...] }` (parsing starts in background) |
| GET    | `/api/rag/sessions/{sid}/docs` | — | `[ { doc_id, name, status, chunks } ]` |
| DELETE | `/api/rag/sessions/{sid}/docs/{doc_id}` | — | `{ ok }` |
| GET    | `/api/rag/sessions/{sid}/events` | — | SSE stream of doc-status changes |
| POST   | `/api/rag/sessions/{sid}/query` | `{ query, docs_only, mode }` | SSE stream of `{type, payload}` events: `plan`, `retrieval`, `token`, `citation`, `done` |
| DELETE | `/api/rag/sessions/{sid}` | — | `{ ok }` (purges blobs + vectors) |

**Streaming protocol.** Each SSE event is JSON:

```json
{ "type": "plan",      "payload": { "sub_questions": ["...", "..."] } }
{ "type": "retrieval", "payload": { "sub_q": "...", "hits": [{doc_id, page, score}] } }
{ "type": "token",     "payload": { "delta": "...部分文本..." } }
{ "type": "citation",  "payload": { "n": 3, "doc_id": "...", "page": 7 } }
{ "type": "done",      "payload": { "report_id": "..." } }
```

This lets the frontend render the outline plan + retrieval transparency panel in parallel with the streaming report text — important for trust in a deep-report tool.

---

## 6. Storage Layout

```
.maw/rag/
├── sessions.json                   # registry: sid → meta, doc list, created_at
├── qdrant/                         # Qdrant local file store
│   └── collection-docs/
└── <sid>/
    ├── uploads/
    │   ├── <doc_id>.pdf
    │   └── <doc_id>.docx
    ├── parsed/
    │   └── <doc_id>.json           # ParsedBlock[] — cached parse output
    └── reports/
        └── <report_id>.md          # generated report archive
```

Per-session isolation makes the "docs-only" guarantee a filter, not a hope. It also makes purging an entire session a single directory delete plus one Qdrant `delete(filter=...)`.

---

## 7. Frontend UX

New top-level tab in `Layout.tsx`: **"Report"** alongside the existing Agents / Queue.

```
┌─ Report ───────────────────────────────────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Drop files here or click to upload                │    │
│  │  PDF · DOCX · TXT · MD       (max 50 MB each)      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Uploaded (3)                                               │
│   ✓ market-2025.pdf      42 pages · 318 chunks              │
│   ✓ pricing.docx          12 pages · 89 chunks              │
│   ⟳ competitor-deck.pdf   parsing…                          │
│                                                             │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  Topic:  [ Q3 市场竞争格局深度分析                    ]      │
│                                                             │
│  [x]  仅检索上传文档 (closed-book)                          │
│  [ ]  Show retrieval debug panel                            │
│                                                             │
│        [ Generate Report ]                                  │
│                                                             │
│  ─────────────────────────────────────────────────────      │
│                                                             │
│  Outline:                                                   │
│   1. 市场概况                                                │
│   2. 主要竞争对手                                            │
│   ...                                                       │
│                                                             │
│  # 报告 (streaming)                                          │
│  根据上传文档，本季度市场呈现 ... [^1]                       │
│  ...                                                        │
│                                                             │
│  Citations:                                                 │
│   [^1] market-2025.pdf, p.4                                 │
│   [^2] pricing.docx, §3.2                                   │
└─────────────────────────────────────────────────────────────┘
```

The checkbox label should be terse and visible. Default: **on** — the user's whole reason for uploading is to ground the report, so closed-book is the safe default. If the user wants open-book they explicitly opt in.

---

## 8. Cost & Latency Notes

For a 20-doc, ~500-page corpus:

| Stage | Time (warm cache) | Cost |
|-------|-------------------|------|
| Parse + chunk | 30-90 s (one-time per session) | free, local |
| Embed (bge-m3 local CPU) | 60-180 s | free, local |
| Embed (Voyage 3 cloud) | 5-15 s | ~$0.10 / 1M tokens |
| Per-query retrieval (hybrid + rerank) | 1-3 s | free, local |
| Sub-question planning (Haiku) | 1-2 s | <$0.001 |
| Report generation (Sonnet 4.6, 8 sections × ~1.5k tokens) | 30-60 s streamed | ~$0.05-$0.15 |
| **Per report total** | **~45-90 s** | **~$0.10-$0.20** |

Local embedding on CPU is the bottleneck for indexing. If users upload large corpora regularly, recommend a GPU or switch to Voyage / Cohere cloud embedding.

**Prompt caching** is a free 10x cost reduction on the report-writing pass: cache the retrieved context block, then reuse it across the multiple section-drafting calls. Use Anthropic prompt caching's 5-min TTL — well within a single report's generation window.

---

## 9. Closed-Book Faithfulness — How We Verify It Actually Works

Designing a "docs-only" toggle is easy. Making it trustworthy is the hard part. Plan:

1. **Hard filter at retrieval** — Qdrant query has `must: [{ key: "sid", match: { value: sid } }]`. No leak path.
2. **Prompt asserts grounding** — system prompt:
   > 你只能引用提供的上下文。若上下文中没有相关信息，请明确说"未在上传文档中找到相关内容"。不要使用你自身的知识来补全。
3. **Citation requirement** — every factual claim must end with `[^N]`. The downstream renderer validates that every `[^N]` resolves to a citation entry; un-cited sentences get flagged in the UI.
4. **Eval set** — build a small (50-item) eval where the gold answer is "not in docs". Track the rate at which the model refuses correctly. Target: ≥95%.
5. **Adversarial probe** — include in the eval queries that the model "knows" the answer to from training data but is not in the uploaded docs. Anything answered is a faithfulness violation.

This is the part of the spec to revisit after a v0 ships — closed-book is the user's whole reason for asking and the part most likely to silently regress.

---

## 10. Implementation Roadmap

**Phase 0 — Spike (1-2 days)**
- Hard-code a one-doc PDF + one-question pipeline end-to-end in a Python script.
- Confirms: unstructured parsing quality, bge-m3 on this hardware, Qdrant local mode wiring, Anthropic SDK streaming.
- Output: a `scripts/rag_spike.py` that prints a streamed report for a fixed PDF + topic.

**Phase 1 — Backend MVP (3-5 days)**
- `lib/rag/` module: `parser.py`, `chunker.py`, `embedder.py`, `store.py`, `retriever.py`, `report.py`.
- 7 new API endpoints in `lib/server.py`.
- Session-scoped storage under `.maw/rag/`.
- Tests: parser round-trip, chunker boundary cases, retrieval filter isolation between sessions, faithfulness eval (10-item bootstrap set).

**Phase 2 — Frontend MVP (2-3 days)**
- New `Report.tsx` page + dropzone + doc list + form + streaming viewer.
- Reuse SSE plumbing from `useApi.ts`.
- React-markdown + remark-gfm for citation rendering.

**Phase 3 — Hardening (3-5 days)**
- Background task queue beyond FastAPI's `BackgroundTasks` (handles concurrent uploads).
- OCR fallback for scanned PDFs.
- Prompt caching wired into the section-drafting loop.
- Faithfulness eval expanded to 50 items, run in CI.

**Phase 4 — Optional**
- Multi-modal chunks (table / figure preservation in the report).
- Re-running a report with different docs (diff view).
- "Continue this report" follow-ups using existing context cache.

---

## 11. Open Questions for the Owner

1. **Embedding location** — local CPU (slower but free + private) or cloud (Voyage / OpenAI, fast but $)? Default in this spec: local bge-m3.
2. **Scope** — is this a feature inside MAW, or a separate sibling project that shares MAW's chassis? Default: feature inside MAW under `lib/rag/` and a new React tab.
3. **OCR** — include scanned-PDF support in v1, or punt to phase 3? Default: punt; many users only upload text PDFs.
4. **Concurrent users** — single-user (today's MAW model) or shared? If shared, add session auth before exposing closed-book; otherwise users could read each other's uploads.
5. **Report archival** — store every generated report under `reports/`? Default: yes, cheap and useful for diff/iteration.

Answer these and Phase 0 can start.
