
var AWS = require('aws-sdk')
var jwt = require('jsonwebtoken'); 
var request = require('request-promise'); 
var jwkToPem = require('jwk-to-pem');


const ssm = new AWS.SSM();


var userPoolId = undefined;
var region = undefined;
var token_url = undefined;
var client_id = undefined;
var message = undefined;
var redirectUri = undefined;
var iss = undefined;
var pems;


var _include_headers = function(body, response, resolveWithFullResponse) {
                                        return {'headers': response.headers, 'body': body};
                                };
                                


async function exchangeCodeForToken(code, message, token_url, client_id, redirectUri) {
    return new Promise((resolve,reject) => {
        console.log("inside exchangeCodeForToken. The input to this function is : " + code);

        var buff = new Buffer.from(message);
        var secret_hash = buff.toString('base64');
        const options = {
        uri: token_url,
        transform: _include_headers,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + secret_hash
        },
        form: {
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'code': code,
            'redirect_uri': redirectUri
        }
        };
        console.log(JSON.stringify(options));

        try{
            request(options)
            .then(response => {console.log(response.body); 
                                if (response.body.error !== undefined) {  reject(new Error("Invalid code"))} else {resolve(response.body)} })
            .catch(reason => {console.log(reason);
                              reject(reason)})
        }
        catch {
            console.log("failed to exchange cognito code to token");
            reject(new Error("failed to exchange cognito code to token"))

        }
    });
};

async function downloadPem(pems, pemOptions )
{
    return new Promise((resolve, reject) => {
     if(pems === undefined)
     {
         request(pemOptions)
         .then(response => {
            pems = {};
            var keys = response.body['keys'];
            for(var i = 0; i < keys.length; i++) {
                //Convert each key to PEM
                var key_id = keys[i].kid;
                var modulus = keys[i].n;
                var exponent = keys[i].e;
                var key_type = keys[i].kty;
                var jwk = { kty: key_type, n: modulus, e: exponent};
                var pem = jwkToPem(jwk);
                pems[key_id] = pem;
            };
            resolve(pems);
         })
         .catch((reason)=> { reject(reason)})
     }
     else
     {
         resolve(pems);
     }
    })
};

async function ValidateToken(pems, event) {

    return new Promise((resolve, reject) => {
        console.log("inside the validate token function");
        var token = JSON.parse(event).access_token;
        console.log("access token is : " + token);
        var decodedJwt = jwt.decode(token, {complete: true});


 console.log('decoded jwt is : ' + JSON.stringify(decodedJwt) );
   if (!decodedJwt) {
       console.log("Not a valid JWT token");
       console.log("The Cognito code you've passed is invalid - Youa re not authorized to execute this Lambda function");
       reject(new Error("invalid jwt"))
   }
   if (decodedJwt.payload.iss != iss) {
    console.log("invalid issuer");
    console.log("The Cognito code you've passed is invalid - Youa re not authorized to execute this Lambda function");
    reject(new Error("invalid jwt"))
    }

      //Reject the jwt if it's not an 'Access Token'
   if (decodedJwt.payload.token_use != 'access') {
    console.log("Not an access token");
    console.log("The Cognito code you've passed is invalid - Youa re not authorized to execute this Lambda function");
    reject(new Error("invalid jwt"))
     }

   //Get the kid from the token and retrieve corresponding PEM
   var kid = decodedJwt.header.kid;
   var pem = pems[kid];
    if (!pem) {
    console.log('Invalid access token');
    console.log("The Cognito code you've passed is invalid - Youa re not authorized to execute this Lambda function");
    reject(new Error("invalid jwt"))
     }

     jwt.verify(token, pem, { issuer: iss }, function(err, payload) {
        if(err) {
          console.log("The Cognito code you've passed is invalid - You are not authorized to execute this Lambda function");
          reject(new Error("The Cognito code you've passed is invalid - You are not authorized to execute this Lambda function"));
        } else {
          console.log("Lambda execution successful");
          resolve(payload)
        }
      });
   


})
}
     



exports.handler = async function(event, context)
{
    
try {
if (!userPoolId)
{
     userPoolId = await ssm.getParameter({Name: '/lambdaFurl/userPoolId'}).promise();
     userPoolId = userPoolId.Parameter.Value;
}

if (!region)
{
    region = await ssm.getParameter({Name: '/lambdaFurl/region'}).promise();
    region = region.Parameter.Value;
}

if ( !token_url )
{
    token_url = await ssm.getParameter({Name: '/lambdaFurl/cognitoUrl'}).promise();
    token_url = token_url.Parameter.Value + '/oauth2/token';
}
    
if (! client_id )
{
    client_id = await ssm.getParameter({Name: '/lambdaFurl/clientId'}).promise();
    client_id = client_id.Parameter.Value;
}

if (!message)
{
     message = await ssm.getParameter({Name: '/lambdaFurl/clientSecret'}).promise();
     message =  client_id + ':' + message.Parameter.Value;
}

if (!redirectUri)
{
     redirectUri = await ssm.getParameter({Name: '/lambdaFurl/redirectUri'}).promise();
     redirectUri =   redirectUri.Parameter.Value;
}

if(!iss)
{
 iss = 'https://cognito-idp.' + region + '.amazonaws.com/' + userPoolId;
}
}
catch(Error)
{
    console.log('Error when initializing required parameters');
    throw new Error('Error when initializing required parameters');
}
    
    console.log(JSON.stringify(event));

    if(event.requestContext.http.method === "OPTIONS")
    {
        return {"message": "Success"}
    }
    


    const pemOptions = 
    {
        url: iss + '/.well-known/jwks.json',
        json: true,
        transform: _include_headers
    };
    
    pems = await downloadPem(pems, pemOptions);
    
    console.log(pems);
    
    try{
        var cognitoCode = JSON.parse(event.body).cognitoCode;
        if (cognitoCode == undefined || cognitoCode == "")
        {
            return ({"message":"You are not authorized to execute this lambda function. Please login and try again!"})
        }
    var tokenResponse = await exchangeCodeForToken(cognitoCode, message, token_url, client_id, redirectUri);
    console.log(tokenResponse);
    }
    catch(err) {
        console.log("error when trying to exchange code for token");
        return {"message": "Error when trying to exchange code for token" };
    }
    
    if ( await tokenResponse.error === undefined)
    {
    
         try{
            var response = await ValidateToken(pems, tokenResponse);
            console.log(response);
            return {"message" : "You are successfully logged in as " + response.username + ". Lambda execution was successful" }
            }
        catch(err)
            {
                console.log("Error when trying to validate token");
                return {"message" : "Error when trying to validate token" };
            }
    
     }
    
    else
    {   console.log("error when trying to exchange code for token");
        console.log(tokenResponse);
        return {"message" : "Error when trying to exchange code for token" };
    }

}

