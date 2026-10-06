import Description from '../../components/atoms/Description/Description';
import PageContainer from '../../components/molecules/PageContainer/PageContainer';
import ProjectCard from '../../components/molecules/ProjectCard/ProjectCard';
import SectionHeading from '../../components/molecules/SectionHeading/SectionHeading';
import { loadProjects } from '../../content/loadProjects';
import style from './Projects.module.css';
import homeStyle from './ProjectDetail.module.css';

const projects = loadProjects();

const Projects = () => (
  <PageContainer>
    <header className={homeStyle.siteHeader}>
      <span className={homeStyle.brand}>BIM Portfolio</span>
      <span className={homeStyle.brandTag}>Проекты с интерактивными BIM-моделями</span>
    </header>

    <SectionHeading
      eyebrow="Проекты"
      title="Объекты с BIM-моделями"
      align="left"
    />
    <div className={style.intro}>
      <Description>
        Выберите проект, чтобы открыть 3D-модель, стадии строительства, свойства элементов и KPI.
      </Description>
    </div>

    {projects.length === 0 ? (
      <p className={style.empty}>Проекты пока не добавлены.</p>
    ) : (
      <div className={style.grid}>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    )}
  </PageContainer>
);

export default Projects;
