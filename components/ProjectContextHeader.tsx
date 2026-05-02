import React from 'react';
import { FolderOpen, MapPin, ChevronRight } from 'lucide-react';
import type { Project } from '../api';

interface ProjectContextHeaderProps {
  project: Project | null;
  onChangeProject?: () => void;
  className?: string;
}

const ProjectContextHeader: React.FC<ProjectContextHeaderProps> = ({
  project,
  onChangeProject,
  className = '',
}) => {
  if (!project) return null;

  return (
    <div className={`flex items-center gap-3 text-gray-600 ${className}`}>
      <FolderOpen className="w-4 h-4 text-gray-400" />

      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs uppercase tracking-widest truncate">
          {project.name}
        </span>

        {project.type && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            <span className="px-2 py-0.5 bg-gray-100 font-mono text-[9px] uppercase tracking-widest text-gray-500 flex-shrink-0">
              {project.type}
            </span>
          </>
        )}

        {project.location && (
          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{project.location}</span>
          </span>
        )}
      </div>

      {onChangeProject && (
        <button
          onClick={onChangeProject}
          className="font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-auto"
        >
          Change
        </button>
      )}
    </div>
  );
};

export default ProjectContextHeader;
