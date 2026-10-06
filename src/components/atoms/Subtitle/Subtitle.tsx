import type { ReactNode } from 'react';
import { cx } from '../../../utils/cx';
import style from './Subtitle.module.css';

export const SubtitleVariant = {
  Default: 'default',
  White: 'white',
} as const;

export type SubtitleVariant = (typeof SubtitleVariant)[keyof typeof SubtitleVariant];

type SubtitleProps = {
  children: ReactNode;
  className?: string;
  variant?: SubtitleVariant;
};

const Subtitle = ({ children, className, variant = SubtitleVariant.Default }: SubtitleProps) => (
  <p
    className={cx(
      style.heroCardSubtitle,
      variant === SubtitleVariant.White && style.heroCardSubtitleWhite,
      className,
    )}
  >
    {children}
  </p>
);

export default Subtitle;
