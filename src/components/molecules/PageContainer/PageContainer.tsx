import type { ReactNode } from 'react';
import style from './PageContainer.module.css';

type PageContainerProps = {
  children: ReactNode;
};

const PageContainer = ({ children }: PageContainerProps) => (
  <div className={style.page}>
    <div className={style.content}>{children}</div>
  </div>
);

export default PageContainer;
