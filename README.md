# Securing Lambda Function URL

This repository is to support the AWS Compute Blog - Securing Lambda function URLs using Cognito, CloudFront and WAF

## Overview

This respository contains mainly AWS CDK Deployment code that creates AWS resources in your AWS account. The CDK code is in the /bin and /lib directories.

The /lib directory also contains three sub-projects that will be used for the CDK deployment, as outlined below:
    a. /lib/front-end-app contains the website files that we'll deploy onto AWS amplify. This will be the entry point to the demos outlined in the blog
    b. /lib/lambda-cognito-trigger contains the Lambda Function code that will be attached to the Cognito User Pool as a "pre sign-up trigger". This Function auto approves a user in Cognito User Pool when the user goes through the "sign up" flow in the front end website
    c. /lib/lambda contains the main Lambda Function code on which the Function URL will be enabled

## Pre-requisites: 
To deploy this solution, you need the following pre-requisites on the client machine:
1.	The AWS Command Line Interface (CLI) installed and configured for use.
    Refer this link to install the CLI. https://aws.amazon.com/cli/
        Note: The user profile used to implement this reference solution should have enough privileges to create the following resources:
        •	IAM roles and policies
        •	Lambda function and function url
        •	Cloudfront Distribution
        •	Cognito user pool and App Client
        •	Systems Manager parameters
        •	Amplify application
        •	CodeCommit repository
        •	WAF ACLs
2.	Node JS is installed ( pre-requisite to install AWS CDK )
    Download Node JS from here: https://nodejs.org/en/download/ 
3.	The AWS CDK V2 is installed
    Refer this link to install AWS CDK V2: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
4. Execute the following commands to create the necessary AWS resources (S3 bucket, IAM role/s etc) that AWS CDK will use to provision AWS resources for the sample solution

    ```
    $ cdk bootstrap
    ```

    Note: you may optionally pass --profile argument to this command if you have configured multiple AWS profiles for your AWS CLI.

    For ex:
    ```
     cdk bootstrap –profile myFirstProfile
    ```
    
    Where myFirstProfile refers to a profile name under ~/.aws/config file. 



## Deploy the demo solution:

1. Clone / Download this GitHub repository ( uncompress if you downloaded an archive )
2. Execute the following commands in Terminal ( Mac OS ) or PowerShell ( Windows ):
    ```
    $ cd <full path of the directory where the GitHub repo was cloned to>
    $ npm install
    $ cd lib/lambda
    $ npm install
    ```
3. Execute the following command to create the S3 bucket and IAM roles that CDK will use to provision the AWS resources.
    ```
    $ cdk bootstrap
    ```

    Notes: 
    1. you may optionally pass --profile argument to this command if you have configured multiple aws profiles for aws CLI
    For ex: cdk bootstrap --profile myFirstProfile
    where myFirstProfile refers to a profile name under ~/.aws/config file 

    2. If CDK has already been bootstrapped in your AWS account, you can skip this step


4. Execute the following command to start deployment AWS resources required for the solution
    ```
    $ cdk deploy 

    Note: 
    •	optionally pass in the --profile argument as / if needed
    •	The deployment can take up-to 15 minutes
    ```

5. Once the deployment completes, the output will look similar to this:
    
    ```
    ✨  Deployment time: 296.18s

    Outputs:
    FurlBlogStack.amplifyAppUrl = https://main.d2ve******.amplifyapp.com
    FurlBlogStack.cognitoHostedUiUrl = https://lambda-furl-******-us-east-1.auth.us-east-1.amazoncognito.com/login?client_id=*******i&response_type=code&redirect_uri=https://main.d2ve******.amplifyapp.com
    FurlBlogStack.lambdaFunctionUrl = https://******.lambda-url.us-east-1.on.aws/
    Stack ARN:
    arn:aws:cloudformation:us-east-1:******:stack/FurlBlogStack/xxxxx-dc58-11ec-xxxx-xxxxxxxx

    ✨  Total time: 297.81s
    ```
6. Open the first url from the output ( amplifyAppUrl ) in your browser. This is the url for the Web Page we’ll be using for the demo

    Note: if you do not see “Welcome to ComputeBlog” page with a Sign In and Continue buttons – very likely the amplify app is in “build” stage and the website is being published. You can verify this by navigating to the Amplify app from aws console. Retry in about 5 minutes if your app is being built.



## Cleaning Up

You may delete the resources provisioned by utilizing the starter kits. You can do this by running the following command.
```
    $ cdk destroy 

        Note: 
        •	optionally pass in the --profile argument as / if needed
        •	The deletion can take up-to 15 minutes
```


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.


