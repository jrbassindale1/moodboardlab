import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, MapPin, Layers, Settings, ChevronRight, ExternalLink } from 'lucide-react';
import type { Project, ProjectType, ProjectStage } from '../api';
import type { MaterialOption } from '../types';

interface ProjectWorkspaceProps {
  project: Project;
  onNavigate: (page: string) => void;
  onEditProject: () => void;
  materials?: MaterialOption[];
}

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials', label: 'Materials' },
  { id: 'renders', label: 'Renders' },
  { id: 'sustainability', label: 'Sustainability' },
  { id: 'precedents', label: 'Precedents' },
  { id: 'briefing', label: 'Briefing' },
];

const CarbonDot: React.FC<{ level: 'low' | 'medium' | 'high' }> = ({ level }) => {
  const colors = {
    low: { dot: 'bg-green-700', text: 'text-green-700' },
    medium: { dot: 'bg-amber-600', text: 'text-amber-600' },
    high: { dot: 'bg-red-600', text: 'text-red-600' },
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[level].dot}`} />
      <span className={`font-mono text-[8px] uppercase tracking-widest ${colors[level].text}`}>
        {level}
      </span>
    </span>
  );
};

const OverviewSection: React.FC<{ project: Project; materials?: MaterialOption[] }> = ({
  project,
  materials = [],
}) => {
  const stats = [
    { val: materials.length || '—', label: 'Materials' },
    { val: '—', label: 'Renders' },
    { val: '—', label: 'Precedents' },
    { val: '—', label: 'Carbon Rating' },
  ];

  return (
    <div>
      {project.brief && (
        <p className="font-mono text-xs text-gray-600 leading-relaxed mb-5">
          {project.brief}
        </p>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-px bg-gray-200 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white py-4 px-3 text-center">
            <div className="font-mono text-xl font-bold text-gray-900">{s.val}</div>
            <div className="font-mono text-[8px] tracking-widest uppercase text-gray-400 mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Active palette strip */}
      {materials.length > 0 && (
        <div className="mb-5">
          <div className="font-mono text-[8px] tracking-widest uppercase text-gray-400 mb-2">
            Active Palette
          </div>
          <div className="flex h-8">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex-1 cursor-pointer"
                style={{ backgroundColor: m.tone }}
                title={m.name}
              />
            ))}
          </div>
          <div className="flex">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex-1 font-mono text-[7px] tracking-wide uppercase text-gray-400 pt-1 text-center truncate"
              >
                {m.category}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="bg-gray-50 border border-gray-200 p-4">
        <div className="font-mono text-[8px] tracking-widest uppercase text-green-700 mb-2.5 font-bold">
          Suggested Next Actions
        </div>
        {[
          'Add materials to your project from the Materials library',
          'Generate a moodboard render in the Workspace',
          'Create a sustainability briefing for your palette',
        ].map((s, i) => (
          <div
            key={i}
            className={`font-mono text-[11px] text-gray-600 py-2 cursor-pointer leading-relaxed ${
              i < 2 ? 'border-b border-gray-200' : ''
            }`}
          >
            <span className="text-gray-300 mr-2">→</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

const MaterialsSection: React.FC<{ materials?: MaterialOption[]; onNavigate: (page: string) => void }> = ({
  materials = [],
  onNavigate,
}) => {
  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Materials assigned to this project will appear here.</p>
        <button
          onClick={() => onNavigate('materials')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[10px] uppercase tracking-widest hover:bg-gray-900 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Browse Materials Library
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-px bg-gray-200">
        {materials.map((m) => (
          <div
            key={m.id}
            className="bg-white flex items-stretch cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div
              className="w-14 min-h-14 flex-shrink-0"
              style={{ backgroundColor: m.tone }}
            />
            <div className="flex-1 px-3.5 py-3 flex flex-col justify-center">
              <div className="font-mono text-[11px] font-bold text-gray-900 uppercase tracking-wide mb-0.5">
                {m.name}
              </div>
              <div className="font-mono text-[9px] text-gray-400 mb-1">{m.finish}</div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[8px] tracking-widest uppercase text-gray-400 bg-gray-100 px-1.5 py-0.5">
                  {m.category}
                </span>
                {m.carbonIntensity && <CarbonDot level={m.carbonIntensity} />}
              </div>
            </div>
            <div className="flex items-center px-3.5 text-gray-300">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onNavigate('materials')}
        className="w-full py-3.5 mt-px border-2 border-dashed border-gray-300 bg-transparent font-mono text-[10px] tracking-widest uppercase text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-500 transition-colors"
      >
        + Add Material
      </button>

      <p className="font-mono text-[9px] text-gray-400 mt-3 leading-relaxed">
        Changing materials here will update sustainability data, precedent suggestions, and render prompts across this project.
      </p>
    </div>
  );
};

const RendersSection: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => (
  <div className="text-center py-12">
    <p className="text-gray-500 mb-4">Renders generated for this project will appear here.</p>
    <button
      onClick={() => onNavigate('moodboard')}
      className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[10px] uppercase tracking-widest hover:bg-gray-900 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      Go to Workspace
    </button>
  </div>
);

const SustainabilitySection: React.FC = () => (
  <div className="text-center py-12">
    <p className="text-gray-500 mb-4">
      Sustainability insights for this project's material palette will appear here.
    </p>
    <p className="text-gray-400 text-sm">
      Add materials and generate a moodboard to see sustainability analysis.
    </p>
  </div>
);

const PrecedentsSection: React.FC = () => (
  <div className="text-center py-12">
    <p className="text-gray-500 mb-4">
      Precedent projects matching this palette will appear here.
    </p>
    <p className="text-gray-400 text-sm">
      Add materials to discover relevant architectural precedents.
    </p>
  </div>
);

const BriefingSection: React.FC = () => (
  <div className="text-center py-12">
    <p className="text-gray-500 mb-4">
      A client-ready or crit-ready briefing will be generated here once materials and renders have been added.
    </p>
    <p className="text-gray-400 text-sm">
      This will include design intent, material rationale, and sustainability summary.
    </p>
  </div>
);

const sectionComponents: Record<string, React.FC<any>> = {
  overview: OverviewSection,
  materials: MaterialsSection,
  renders: RendersSection,
  sustainability: SustainabilitySection,
  precedents: PrecedentsSection,
  briefing: BriefingSection,
};

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project,
  onNavigate,
  onEditProject,
  materials = [],
}) => {
  const [activeSection, setActiveSection] = useState('overview');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );

    (Object.values(sectionRefs.current) as (HTMLDivElement | null)[]).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (navRef.current) {
      const activeEl = navRef.current.querySelector(`[data-nav="${activeSection}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeSection]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Sub-header with back button */}
      <div className="sticky top-20 z-40 bg-white border-b border-gray-200">
        <div className="max-w-screen-lg mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-2 font-mono text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Projects
          </button>
          <button
            onClick={onEditProject}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {/* Project header */}
      <div className="max-w-screen-lg mx-auto px-6 pt-6">
        <div className="flex justify-between items-start mb-1">
          <div>
            <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-gray-400 mb-1.5">
              {project.type && <span>{project.type}</span>}
              {project.type && project.stage && <span>·</span>}
              {project.stage && <span>{project.stage}</span>}
            </div>
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-gray-900 leading-tight">
              {project.name}
            </h1>
          </div>
        </div>
        {project.location && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400 mt-2">
            <MapPin className="w-3 h-3" />
            {project.location}
          </div>
        )}
        <div className="font-mono text-[9px] text-gray-300 mt-1">
          Updated {formatDate(project.updatedAt)}
        </div>
      </div>

      {/* Sticky section nav */}
      <div className="sticky top-[136px] z-30 bg-white border-b border-gray-200 mt-5">
        <div
          ref={navRef}
          className="flex max-w-screen-lg mx-auto overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sections.map((s) => {
            const isActive = s.id === activeSection;
            return (
              <button
                key={s.id}
                data-nav={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`font-mono text-[9px] tracking-widest uppercase px-4 py-3 border-b-2 cursor-pointer whitespace-nowrap flex-shrink-0 transition-all ${
                  isActive
                    ? 'text-gray-900 border-gray-900 font-bold'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-screen-lg mx-auto px-6 pb-20">
        {sections.map((s) => {
          const Component = sectionComponents[s.id];
          const props: Record<string, unknown> = {};

          if (s.id === 'overview') {
            props.project = project;
            props.materials = materials;
          }
          if (s.id === 'materials') {
            props.materials = materials;
            props.onNavigate = onNavigate;
          }
          if (s.id === 'renders') {
            props.onNavigate = onNavigate;
          }

          return (
            <div
              key={s.id}
              ref={(el) => (sectionRefs.current[s.id] = el)}
              data-section={s.id}
              className="pt-7"
            >
              <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-gray-100">
                <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-gray-900">
                  {s.label}
                </h2>
                {s.id !== 'overview' && (
                  <span className="font-mono text-[8px] text-gray-300 tracking-widest uppercase cursor-pointer hover:text-gray-500">
                    Expand →
                  </span>
                )}
              </div>
              <Component {...props} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectWorkspace;
