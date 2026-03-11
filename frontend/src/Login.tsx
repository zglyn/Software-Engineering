import React from 'react';
import { Link } from 'react-router-dom';
import './Login.css';
import { useState } from 'react';

const HomePage: React.FC = () => {
  const [uservalue, setUserValue] = useState('');
  const [passvalue, setPassValue] = useState('');
  const [Signup, setSignupClicked] = useState(false);
  const [Login, setLoginClicked] = useState(false);


  const handleSignUpClick = () => {
    setSignupClicked(true);
  };

  const handleLoginClick = () => {
    setLoginClicked(true);
  };

  return (
    <div >
    {/* // <div style={{ backgroundColor: 'white', minHeight: '100vh' }}> */}
        <div className='AppCSS'>
          <h1>Sign Up/Login</h1>
        </div>
        
        
         <input
          className='roundedBox'
          type="text"
          placeholder="Username" 
          value={uservalue}
          onChange={(e) => setUserValue(e.target.value)}
         />

         <input
          className='roundedBox'
          type="password"
          placeholder="Password" 
          value={passvalue}
          onChange={(e) => setPassValue(e.target.value)}
         />

        <div className='ButtonAlign'>
          <button onClick={handleSignUpClick} className='roundedButtons'>
          Sign Up
          </button>
          <button onClick={handleLoginClick} className='roundedButtons'>
          Login
          </button>
        </div>
    </div>
  );
};
export default HomePage;