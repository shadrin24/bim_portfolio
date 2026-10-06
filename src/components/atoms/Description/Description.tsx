import type { ReactNode } from 'react';
import { cx } from '../../../utils/cx';
import style from './Description.module.css';

type DescriptionProps = {
  children: ReactNode;
  className?: string;
};

const Description = ({ children, className }: DescriptionProps) => (
  <p className={cx(style.heroCardDescription, className)}>{children}</p>
);

export default Description;
