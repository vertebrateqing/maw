import { FolderOpen } from "lucide-react";

interface ProjectPathProps {
  path: string;
}

export function ProjectPath({ path }: ProjectPathProps) {
  // Extract project name from full path for compact display
  const projectName = path.split("/").pop() || path;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] min-w-0"
      title={path}
    >
      <FolderOpen size={12} className="shrink-0 text-[#00bcd4]" />
      <span className="text-xs font-mono text-[#aaaaaa] truncate max-w-[120px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-[240px]">
        {projectName}
      </span>
    </div>
  );
}
