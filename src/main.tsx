import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app/App';
import './styles.css';
document.documentElement.dataset.contrast=localStorage.getItem('uem:contrast')??'default';
createRoot(document.getElementById('root')!).render(<App/>);
