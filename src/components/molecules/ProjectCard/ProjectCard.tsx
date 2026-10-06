import { Link } from 'react-router-dom';
import type { Project } from '../../../content/types';
import style from './ProjectCard.module.css';

type ProjectCardProps = {
  project: Project;
};

const ProjectCard = ({ project }: ProjectCardProps) => (
  <article className={style.card}>
    <Link to={`/proekty/${project.slug}`} className={style.link}>
      <div className={style.cover}>
        {project.cover ? (
          <img src={project.cover} alt="" className={style.image} />
        ) : (
          <span className={style.coverPlaceholder} aria-hidden="true">
            BIM
          </span>
        )}
      </div>
      <div className={style.body}>
        {project.stage && <span className={style.stage}>{project.stage}</span>}
        <h3 className={style.title}>{project.title}</h3>
        {project.address && <p className={style.address}>{project.address}</p>}
        {project.disciplines && project.disciplines.length > 0 && (
          <ul className={style.disciplines}>
            {project.disciplines.map((item) => (
              <li key={item} className={style.discipline}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  </article>
);

export default ProjectCard;
