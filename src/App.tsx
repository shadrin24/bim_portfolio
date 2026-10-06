import { Route, Routes } from 'react-router-dom';
import Projects from './pages/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';

const App = () => (
  <Routes>
    <Route path="/" element={<Projects />} />
    <Route path="/proekty" element={<Projects />} />
    <Route path="/proekty/:slug" element={<ProjectDetail />} />
    <Route path="*" element={<Projects />} />
  </Routes>
);

export default App;
