import React from 'react';
import { Link } from 'react-router-dom';
import './Profile.css';
import { useState } from 'react';

const HomePage: React.FC = () => {
  const [uservalue, setUserValue] = useState('');
  const [passvalue, setPassValue] = useState('');
  const [userName, setNameValue] = useState('');
  const [teamvalue, setTeamValue] = useState('');
  const [rolevalue, setroleValue] = useState('');
  const [posvalue, setposValue] = useState('');
  const [heightvalue, setheightValue] = useState('');
  const [weightvalue, setweightValue] = useState('');

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
          <h1>Profile</h1>
        </div>
        
        


<div className='ProfileCSS'>
          Name
          <input
          className='roundedBox'
          type="text"
          placeholder="Lebron James" 
          value={userName}
          onChange={(e) => setNameValue(e.target.value)}
         />
          Team
          <input
          className='roundedBox'
          type="text"
          placeholder="LA Lakers" 
          value={teamvalue}
          onChange={(e) => setTeamValue(e.target.value)}
         />
         Username
         <input
          className='roundedBox'
          type="text"
          placeholder="LebronJames23" 
          value={uservalue}
          onChange={(e) => setUserValue(e.target.value)}
         />


          Role
          <input
          className='roundedBox'
          type="text"
          placeholder="Player" 
          value={rolevalue}
          onChange={(e) => setroleValue(e.target.value)}
         />



         Position
         <input
          className='roundedBox'
          type="text"
          placeholder="Small Forward" 
          value={posvalue}
          onChange={(e) => setposValue(e.target.value)}
         />

            Height
          <input
          className='roundedBox'
          type="text"
          placeholder="6'9" 
          value={heightvalue}
          onChange={(e) => setheightValue(e.target.value)}
         />
          Weight
          <input
          className='roundedBox'
          type="text"
          placeholder="250 lbs" 
          value={weightvalue}
          onChange={(e) => setweightValue(e.target.value)}
         />

        
         Password
         <input
          className='roundedBox'
          type="text"
          placeholder="********" 
          value={passvalue}
          onChange={(e) => setPassValue(e.target.value)}
         />

</div>

        <div className='ButtonAlign'>
          <button onClick={handleSignUpClick} className='roundedButtons'>
          Update
          </button>
          <button onClick={handleLoginClick} className='roundedButtons'>
          Delete
          </button>
        </div>
        
        


        
    </div>
  );
};
export default HomePage;