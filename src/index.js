import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import firebase from './lib/firebase'

const app = firebase.init()
const analytics = firebase.analytics(app)

ReactDOM.render(<App />, document.getElementById('root'));
registerServiceWorker();
