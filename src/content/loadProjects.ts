import type { Project } from './types';

const modules = import.meta.glob('./projects/*.json', { eager: true });

const asProject = (mod: unknown): Project | null => {
  if (!mod || typeof mod !== 'object') return null;
  const record = mod as { default?: Project } & Partial<Project>;
  const project = record.default ?? (record as Project);
  if (!project?.slug || !project?.title) return null;
  return project;
};

export const loadProjects = (): Project[] =>
  Object.values(modules)
    .map(asProject)
    .filter((project): project is Project => project != null)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

export const loadProjectBySlug = (slug: string): Project | undefined =>
  loadProjects().find((project) => project.slug === slug);
