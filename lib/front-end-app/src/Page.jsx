import React, {useState, useEffect} from 'react';
import './App.css'

import logo from './AWS_logo_RGB.svg'
//import logo from './logo.svg'
const Page = () =>

{

    const [Signin, setSignin] = useState(false);
    const [Continue, setContinue] = useState(false);
    const [Body, setBody] = useState(<></>);
    const [GoBackHome, setGoBackHome] = useState(false);
   


   useEffect(() => {

    setBody(<div className="App">
                        <header className="App-header">
                            <img src={logo} className="App-logo" alt="aws" />
                            <p>Welcome to aws ComputeBlog</p>
                         </header>
                         <body className="App-body">
                           <p> Lambda execution is submitted.  
                              <br></br>If you are authenticated, the lambda will execute and you will see a pop-up on this page that says 'Lambda execution successful'. 
                              <br></br>If you are unauthenticated, you'll see a pop-up with a messaging stating you are not authorized.
                           </p>
                           <button className="btn" onClick={() => { document.cookie="code="; window.location.assign('/'); }}>Return to Home Page</button>
                         </body>
                     </div>);
    
     }, [GoBackHome]);

    const callLambda = () => {

      
        const value = `; ${document.cookie}`;
        const parts = value.split("; code=");
        if (parts.length === 2) 
        var code = parts.pop().split(';').shift();
        
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ cognitoCode: code })
        }

        fetch(process.env.REACT_APP_CLOUDFRONT_LAMBDA_DISTRIBUTION_URL, requestOptions)
        .then(response => response.json())
        .then(data => { alert(JSON.stringify(data));})
        ;
      
    }

    
    

    useEffect(() => {
        if(Continue) {
        setBody (<div className="App">
        <header className="App-header">
            <img src={logo} className="App-logo" alt="aws" />
            <p>Welcome to aws ComputeBlog</p>
         </header>
         <body className="App-body">
           <p> Click on the 'Execute Lambda' button below.  
              <br></br>If you are authenticated, the lambda will execute and you will see a pop-up on this page that says 'Lambda execution successful'. 
              <br></br>If you are unauthenticated, you'll see a pop-up with 'You are not authorized to execute the function'
           </p>
           <button className="btn" onClick={() => { callLambda(); document.cookie="code="; setGoBackHome(true); } }>Execute Lambda</button>
         </body>
     </div>);
        }

    },[Continue]);

    useEffect(() => {
        if(Signin)
        {
        window.location.assign(process.env.REACT_APP_COGNITO_HOSTED_UI_URL);
        }

        /*{
        var requestOptionsFurl = {
          method: 'GET'
         };

         fetch('https://q6nnei6gt5epmgmewi5x5zu4rq0ernmr.lambda-url.us-east-1.on.aws/', requestOptionsFurl)
         .then(response => response.json())
         .then(data => {
            if (data.message.indexOf("Error") === -1 )
            {
              window.location.assign(data.message)
            }
            else{
              alert(data.message);
            }
          })
        
         ;
         setSignin(false);

        }*/

      },[Signin]);

    useEffect(() => {
            //everytime the page loads, determine if the ?code= url string is present. This url parameter is set by cognito hosted ui.
            //If present, set this code as cookie with name code. We'll send this cookie value to lambda to determine
            // if the user is authorized to execut the business logic in the lambda hence mimicing the Cognito Authorization in API gateway
            var url = window.location.search;
            if(url.indexOf("code=") !== -1 ) //meaning the url string has the code, it is returned from cognito hosted ui after successful authentication. Now save the code as cookie and show the "execute lambda page"
            {
            document.cookie="code="+ url.substring(6,url.length);
            setBody(<div className="App">
                        <header className="App-header">
                        <img src={logo} className="App-logo" alt="aws" />
                        <p>Welcome to aws ComputeBlog</p>
                        </header>
                        <body className="App-body">
                          <p> Click on the 'Execute Lambda' button below.  
                          <br></br>If you are authenticated, the lambda will execute and you will see a pop-up on this page that says 'Lambda execution successful'. 
                          <br></br>If you are unauthenticated, you'll see a pop-up with 'You are not authorized to execute the function'
                          </p>
                         <button className="btn" onClick={() => {callLambda(); setGoBackHome(true);} }>Execute Lambda</button>
                        </body>
                    </div>);

            }
            else {
            document.cookie="code=''";
            fetch()
            //Everytime page loads, set the body of the page as the page that shows the login and contineu buttons
            setBody(<div className="App">
                       <header className="App-header">
                           <img src={logo} className="App-logo" alt="aws" />
                           <p>Welcome to aws ComputeBlog</p>
                        </header>
                        <body className="App-body">
                          <button className="btn" onClick={() => setSignin(true)}>Sign In</button>
                          <br></br>
                          <br></br>
                          <br></br>
                          <button className="btn1" onClick={() => {document.cookie="code="; setContinue(true)}}>Continue</button>
                        </body>
                    </div>);
            }
            
                    },[]);


return (
  <div>{Body}</div>
)

}

export default Page;