import { cx } from '../../../utils/cx';
import Title from '../../atoms/Title/Title';
import style from './SectionHeading.module.css';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  align?: 'left' | 'center';
  className?: string;
};

const SectionHeading = ({ eyebrow, title, align = 'center', className }: SectionHeadingProps) => (
  <div className={cx(style.heading, align === 'left' && style.left, className)}>
    {eyebrow && <span className={style.eyebrow}>{eyebrow}</span>}
    <Title level={2} className={style.title}>
      {title}
    </Title>
  </div>
);

export default SectionHeading;
