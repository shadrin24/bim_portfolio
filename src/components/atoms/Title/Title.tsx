import type { ReactNode } from 'react';
import { cx } from '../../../utils/cx';
import style from './Title.module.css';

type TitleLevel = 1 | 2 | 3;

type TitleProps = {
  children: ReactNode;
  level?: TitleLevel;
  className?: string;
};

const levelClassMap = { 1: style.title1, 2: style.title2, 3: style.title3 } as const;

const Title = ({ children, level = 1, className }: TitleProps) => {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  return (
    <Tag className={cx(style.heroCardTitle, levelClassMap[level], className)}>{children}</Tag>
  );
};

export default Title;
