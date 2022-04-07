
// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2_i3UQH_43vpyjUe1L1U-OoFloIYbXoA",
  authDomain: "secret-santa-6a7a9.firebaseapp.com",
  projectId: "secret-santa-6a7a9",
  storageBucket: "secret-santa-6a7a9.appspot.com",
  messagingSenderId: "977865012502",
  appId: "1:977865012502:web:e20cca8086b4ae946f8c37",
  measurementId: "G-00634BZ9KT"
}

const firebase = {}

firebase.init = () => {
    const app = initializeApp(firebaseConfig)
    console.log('Firebase initialized')
    return app
}

firebase.analytics = (app) => {
    const analytics = getAnalytics(app)
    console.log('Analytics initialized')
    return analytics
}

export default firebase