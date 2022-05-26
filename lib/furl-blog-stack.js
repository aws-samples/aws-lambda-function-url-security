const { Stack } = require('aws-cdk-lib');
const cdk = require('aws-cdk-lib');
const amplify  = require('@aws-cdk/aws-amplify-alpha');
const path = require ( 'path' );
const customResource = require('aws-cdk-lib/custom-resources')
const ssm = require('aws-cdk-lib/aws-ssm');
const cognito = require('aws-cdk-lib/aws-cognito')
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const { Construct } = require('constructs');
const {  PolicyStatement } = require('aws-cdk-lib/aws-iam');
const codeCommit = require('aws-cdk-lib/aws-codecommit');
const origins = require('aws-cdk-lib/aws-cloudfront-origins')
const cloudFront = require('aws-cdk-lib/aws-cloudfront');
const wafv2 = require('aws-cdk-lib/aws-wafv2');
const { UserPoolClient } = require('aws-cdk-lib/aws-cognito');


class FurlBlogStack extends Stack {

  //Create rules for WAF

  makeRules = function(listOfRules)  {
    var rules = wafv2.CfnRuleGroup.RuleProperty = [];
  
    listOfRules.forEach(function (r) {
      var mrgsp = wafv2.CfnWebACL.ManagedRuleGroupStatementProperty = {
        name: r['name'],
        vendorName: "AWS",
        excludedRules: []
      };
  
      var stateProp = wafv2.CfnWebACL.StatementProperty = {
        managedRuleGroupStatement: {
          name: r['name'],
          vendorName: "AWS",
        }
      };
      var overrideAction = wafv2.CfnWebACL.OverrideActionProperty = { none: {} }
  
      var rule = wafv2.CfnWebACL.RuleProperty = {
        name: r['name'],
        priority: r['priority'],
        overrideAction: overrideAction,
        statement: stateProp,
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: r['name']
        },
      };
      rules.push(rule);
    }); // forEach
  
    // Allowed country list. Here, we're only allowing requests from US and CA to pass through to cloudfront endpoint.
    var ruleGeoMatch = wafv2.CfnWebACL.RuleProperty = {
      name: 'GeoMatch',
      priority: 0,
      action: {
        block: {} // To disable, change to *count*
      },
      statement: {
        notStatement: {
          statement: {
            geoMatchStatement: {
              // block connection if source not in the below country list
              countryCodes: [
                "US",
                "CA"
              ]
            }
          }
        }
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'GeoMatch'
      }
    }; // GeoMatch
    rules.push(ruleGeoMatch);
  
    /**
     * The rate limit is the maximum number of requests from a
     * single IP address that are allowed in a five-minute period.
     * This value is continually evaluated,
     * and requests will be blocked once this limit is reached.
     * The IP address is automatically unblocked after it falls below the limit.
     */
    //Here we're limiting the no of requests from a specific ip to 100 per 5 minute window
    var ruleLimitRequests100 = wafv2.CfnWebACL.RuleProperty = {
      name: 'LimitRequests100',
      priority: 1,
      action: {
        block: {} // To disable, change to *count*
      },
      statement: {
        rateBasedStatement: {
          limit: 100,
          aggregateKeyType: "IP"
        }
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'LimitRequests100'
      }
    }; // limit requests to 100
    rules.push(ruleLimitRequests100);
  
    return rules;
  } // function makeRules

  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);


// Step 1: create a code commit repo to host the code in ./lib/front-end-app folder

let repo = new codeCommit.Repository(this, 'lambdaFurlCodeRepo', {
  repositoryName: 'lambda-furl-front-end-app' + cdk.Stack.of(this).account + '-' + cdk.Stack.of(this).region,
  code: codeCommit.Code.fromDirectory(path.join(__dirname, 'front-end-app/'), 'main'),
  removalPolicy: cdk.RemovalPolicy.DESTROY
});

// Step 2: create an amplify app that's sourced from the repo created in step 1
const amplifyApp = new amplify.App(this, 'lambdaFurlWebSite', {
  sourceCodeProvider: new amplify.CodeCommitSourceCodeProvider({
    repository: repo
  }),
  autoBranchCreation: { 
    patterns: ['main/*']
  },
  autoBranchDeletion: true 
});

// Step 2.1: create a branch called main in the amplify app. This is to ensure that our amplify app's url is going to be main.<amplifyapp.defaultDomain>
amplifyApp.addBranch('main');

// Step 3: create cognito userpool with preferredUsername attribute. This userpool's hosted UI will be used in our amplify app when "sign in" button is clicked on
const userPool = new cognito.UserPool(this, 'userPool', {
  selfSignUpEnabled: true, 
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  userPoolName: 'lambdaFurl-userPool', 
  autoVerify: true, 
  standardAttributes: {
  preferredUsername: {
    required: false,
    mutable: true
  }
}});

userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP , new lambda.Function(this, 'lambdaFurlPreSignUpTrigger', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-cognito-trigger'))
}));

// step 3.1: create an App Client for the userpool we just created

const userPoolClient = userPool.addClient('computeWebsiteClient', {
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [ cognito.OAuthScope.OPENID ],
    callbackUrls: [ 'https://main.' + amplifyApp.defaultDomain ]
  },
  generateSecret: true,
  
});

// step 3.2: register a domain prefix for the hosted ui 

const userPoolDomain = userPool.addDomain('computeWebisteClientDomain',{
  cognitoDomain:
  {
    domainPrefix: 'lambda-furl-' + cdk.Stack.of(this).account + '-' + cdk.Stack.of(this).region
  }

});

// step 3.3: Register a callback url for the hosted UI. Here, we're saying once the authentication is successful, redirect back to the amplify app's page

const signInUrl = userPoolDomain.signInUrl(userPoolClient, {
  redirectUri: 'https://main.' + amplifyApp.defaultDomain, // must be a URL configured under 'callbackUrls' with the client
});




// Step 4: create a IAM policy that will be attached to the lambda function. Here, we're only giving lambda function ssm:getParameter rights since our lambda function is only using ssm service
const lambdaFnPolicy = new PolicyStatement();
lambdaFnPolicy.addActions('ssm:GetParameter');
lambdaFnPolicy.addResources('*');

// Step 4.1: create a lambda function with the IAM policy from previous step. The code for the labmda function is in the './lib/lambda' folder
const lambdaFn = new lambda.Function(this, 'lambdaWithFurl', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
  initialPolicy: [lambdaFnPolicy]
});


// Step 5: enable lambda function url for the function created in step 4
const lambdaFurl = lambdaFn.addFunctionUrl({authType: lambda.FunctionUrlAuthType.NONE, 
cors: {
allowedOrigins: ['*']
}});


// Step 6: In preparation for creating the WAF and Cloudfront distro , add any additional required WAF rules to an object named listOfRules

       const listOfRules = [{
        "name": "AWSManagedRulesCommonRuleSet",
        "priority": 10,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        "name": "AWSManagedRulesAmazonIpReputationList",
        "priority": 20,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        "name": "AWSManagedRulesKnownBadInputsRuleSet",
        "priority": 30,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        "name": "AWSManagedRulesAnonymousIpList",
        "priority": 40,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        "name": "AWSManagedRulesLinuxRuleSet",
        "priority": 50,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        "name": "AWSManagedRulesUnixRuleSet",
        "priority": 60,
        "overrideAction": "none",
        "excludedRules": [],
      }];

      // Step 6.1: create the waf ACL using the rules from previous step

      const wafAclCloudFront = new wafv2.CfnWebACL(this, "WafCloudFront", {
        defaultAction: { allow: {} },
        /**
         * The scope of this Web ACL.
         * Valid options: CLOUDFRONT, REGIONAL.
         * For CLOUDFRONT, you must create your WAFv2 resources
         * in the US East (N. Virginia) Region, us-east-1
         */
        scope: "CLOUDFRONT",
        // Defines and enables Amazon CloudWatch metrics and web request sample collection.
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: "waf-cloudfront",
          sampledRequestsEnabled: true
        },
        description: "WAFv2 ACL for CloudFront",
        name: "waf-cloudfront",
        rules: this.makeRules(listOfRules),
      }); // wafv2.CfnWebACL

      //create cloudfront distro with the lambda furl as the origin and set the waf ACL association with the distribution
    
      // step 7: create the cloudfront response header policy . Set the CORS rules to allow all methods and all origins. This may be a bit generous but OK for demo purposes(?)
      const cfResponseHeadersPolicy = new cloudFront.ResponseHeadersPolicy(this, 'cfResponseHeadersPolicy', 
                                              {responseHeadersPolicyName: 'lambdaFurlCloudFrontPolicy',
                                              corsBehavior: {accessControlAllowCredentials: false,
                                               accessControlAllowHeaders: ['*'],
                                               accessControlAllowMethods: ["GET","HEAD","OPTIONS","PUT","PATCH","POST","DELETE"],
                                               accessControlAllowOrigins: ['*'],
                                               accessControlExposeHeaders: ['*'],
                                               accessControlMaxAge: cdk.Duration.seconds(600),
                                               originOverride: true}});
       
      // step 7: create the cloudfront distro  with the wafACL association from step 6. Set the origin as the lambda function url created in previous steps.
      const lambdaFurlCfd = new cloudFront.Distribution(this, 'lambdaFurlCloudfrontDist', {
        defaultBehavior: { origin: new origins.HttpOrigin( cdk.Fn.select(2, cdk.Fn.split("/", lambdaFurl.url))),
                           allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
                           viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.ALLOW_ALL,
                           originRequestPolicy: cloudFront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
                           responseHeadersPolicy: cfResponseHeadersPolicy
                        },
        webAclId: wafAclCloudFront.attrArn
      });

      //Step 8: update the amplify app to have the conigo hosted ui and cloudfront distribution url as environment variables. These will then be used in the build process to create the .env file on amplify. See amplify.yml in lib/front-end-app folder.

 const updatedAmplifyApp = new customResource.AwsCustomResource(this, 'updateAmplifyApp', {
  policy: customResource.AwsCustomResourcePolicy.fromStatements([new PolicyStatement({actions: ['amplify:UpdateApp', 'amplify:StartJob', 'cognito-idp:DescribeUserPoolClient'], resources: ['*'], effect: iam.Effect.ALLOW})]),
  onCreate: {
      service: 'Amplify',
      action: 'updateApp',
      physicalResourceId: customResource.PhysicalResourceId.of('update-amplify-env-variable'),
      parameters: {
          appId: amplifyApp.appId,
          environmentVariables: {
            'COGNITO_HOSTED_UI_URL' : signInUrl,
            'CLOUDFRONT_LAMBDA_DISTRIBUTION_URL': `https://${lambdaFurlCfd.distributionDomainName}`
          }
      }
  },
  onUpdate: {
    service: 'Amplify',
    action: 'updateApp',
    physicalResourceId: customResource.PhysicalResourceId.of('update-amplify-env-variable'),
    parameters: {
      appId: amplifyApp.appId,
      environmentVariables: {
        'COGNITO_HOSTED_UI_URL' : signInUrl,
        'CLOUDFRONT_LAMBDA_DISTRIBUTION_URL': `https://${lambdaFurlCfd.distributionDomainName}`
      }
  }
}
});

// step 9: trigger a build on the amplify app. This is to ensure that the ingested environment variables are taking effect on the amplify app.
const amplifyAppBuildTrigger = new customResource.AwsCustomResource(this, 'triggerAppBuild', {
  policy: customResource.AwsCustomResourcePolicy.fromStatements([new PolicyStatement({actions: ['amplify:UpdateApp', 'amplify:StartJob', 'cognito-idp:DescribeUserPoolClient'], resources: ['*'], effect: iam.Effect.ALLOW})]),
  onCreate: {
      service: 'Amplify',
      action: 'startJob',
      physicalResourceId: customResource.PhysicalResourceId.of('app-build-trigger'),
      parameters: {
          appId: amplifyApp.appId,
          branchName: 'main',
          jobType: 'RELEASE',
          jobReason: 'Auto Start build'
      }
  },
  onUpdate: {
    service: 'Amplify',
    action: 'startJob',
    physicalResourceId: customResource.PhysicalResourceId.of('app-build-trigger'),
    parameters: {
        appId: amplifyApp.appId,
        branchName: 'main',
        jobType: 'RELEASE',
        jobReason: 'Auto Start build'
    }
}
});

// step 9.1: Here we're simply telling cdk / cfn to wait until the amplify app's environment variables are updated before triggering the build

amplifyAppBuildTrigger.node.addDependency(updatedAmplifyApp);


const describeCognitoUserPoolClient = new customResource.AwsCustomResource(
  this,
  'DescribeCognitoUserPoolClient',
  {
    resourceType: 'Custom::DescribeCognitoUserPoolClient',
    onCreate: {
      region: 'us-east-1',
      service: 'CognitoIdentityServiceProvider',
      action: 'describeUserPoolClient',
      parameters: {
        UserPoolId: userPool.userPoolId,
        ClientId: userPoolClient.userPoolClientId,
      },
      physicalResourceId: customResource.PhysicalResourceId.of(userPoolClient.userPoolClientId),
    },
    // TODO: can we restrict this policy more?
     policy: customResource.AwsCustomResourcePolicy.fromStatements([new PolicyStatement({actions: ['amplify:UpdateApp', 'amplify:StartJob', 'cognito-idp:DescribeUserPoolClient'], resources: ['*'], effect: iam.Effect.ALLOW})]),
  }
)

describeCognitoUserPoolClient.node.addDependency(userPoolClient);
describeCognitoUserPoolClient.node.addDependency(userPool);

const userPoolClientSecret = describeCognitoUserPoolClient.getResponseField(
  'UserPoolClient.ClientSecret'
)

// Store the parameters 
const userPoolIdSsmParam = new ssm.StringParameter(this, 'userPoolId', {parameterName: '/lambdaFurl/userPoolId', stringValue: userPool.userPoolId, removalPolicy: cdk.RemovalPolicy.DESTROY});
userPoolIdSsmParam.node.addDependency(userPool);
 new ssm.StringParameter(this, 'userPoolRegion', {parameterName: '/lambdaFurl/region', stringValue: cdk.Stack.of(this).region, removalPolicy: cdk.RemovalPolicy.DESTROY});
const userPoolLoginUrlSsmParam = new ssm.StringParameter(this, 'userPoolLoginUrl', {parameterName: '/lambdaFurl/cognitoUrl', stringValue: userPoolDomain.baseUrl({fips: false}), removalPolicy: cdk.RemovalPolicy.DESTROY});
userPoolLoginUrlSsmParam.node.addDependency(userPoolDomain);
const userPoolClientIdSsmParam = new ssm.StringParameter(this, 'userPoolClientId', {parameterName: '/lambdaFurl/clientId', stringValue: userPoolClient.userPoolClientId, removalPolicy: cdk.RemovalPolicy.DESTROY});
userPoolClientIdSsmParam.node.addDependency(userPoolClient);
new ssm.StringParameter(this, 'userPoolClientSecret', {parameterName: '/lambdaFurl/clientSecret', stringValue: userPoolClientSecret, removalPolicy: cdk.RemovalPolicy.DESTROY});
const userPoolRedirectUri = new ssm.StringParameter(this, 'hostedUiRedirectUri', { parameterName: '/lambdaFurl/redirectUri', stringValue: 'https://main.' + amplifyApp.defaultDomain, removalPolicy: cdk.RemovalPolicy.DESTROY});
userPoolRedirectUri.node.addDependency(amplifyApp);




new cdk.CfnOutput(this, 'amplifyAppUrl', {
  value: "https://main."+ amplifyApp.defaultDomain,
  description: 'The url for the amplify app bucket',
  exportName: 'amplifyAppUrl',
});

new cdk.CfnOutput(this, 'lambdaFunctionUrl', {
  value: lambdaFurl.url,
  description: 'URL for the lambda function',
  exportName: 'lambdaFurl'
})

new cdk.CfnOutput(this, 'cognitoHostedUiUrl', {
  value: signInUrl,
  description: 'URL for the cognito hosted UI',
  exportName: 'signInUrl'
});


  }
}



module.exports = { FurlBlogStack }
