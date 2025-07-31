#!/usr/bin/env node

/**
 * Script to automate the process of building a Docker image and deploying it to AWS ECR
 * This script performs:
 * 1. Builds the Docker image
 * 2. Logs in to AWS ECR
 * 3. Tags the image
 * 4. Pushes the image to ECR
 * 5. Optionally updates the Lambda function
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuration from environment variables or default values
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const AWS_REGION = process.env.AWS_REGION;
const AWS_ECR_REPOSITORY = process.env.AWS_ECR_REPOSITORY;
const IMAGE_TAG = process.env.IMAGE_TAG || 'latest';
const DOCKERFILE_PATH = process.env.DOCKERFILE_PATH || path.resolve(__dirname, '../Dockerfile');
const UPDATE_LAMBDA = process.env.UPDATE_LAMBDA === 'true';

// Make sure Dockerfile exists
if (!fs.existsSync(DOCKERFILE_PATH) && fs.existsSync(`${DOCKERFILE_PATH}.example`)) {
  console.log('Dockerfile not found. Copying from Dockerfile.example...');
  fs.copyFileSync(`${DOCKERFILE_PATH}.example`, DOCKERFILE_PATH);
  console.log('Dockerfile copied successfully.');
}

/**
 * Executes a command with error handling
 * @param {string} command - Command to execute
 * @param {string} errorMessage - Custom error message
 * @returns {string} - Result of the command execution
 */
function executeCommand(command, errorMessage) {
  console.log(`Executing: ${command}`);
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
    return result;
  } catch (error) {
    console.error(`ERROR: ${errorMessage}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Main process
 */
async function main() {
  try {
    console.log('====== STARTING DEPLOYMENT PROCESS ======');
    const startTime = new Date().getTime();
    
    // Verify AWS credentials
    console.log('\nVerifying AWS credentials...');
    try {
      const awsCheck = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf8' }).trim();
      console.log(`AWS configured correctly. Account ID: ${awsCheck}`);
    } catch (error) {
      console.error('No valid AWS credentials found. Please configure AWS CLI.');
      process.exit(1);
    }
    
    // Build Docker image
    console.log('\nBuilding Docker image...');

    let buildCommand;
    if (os.platform() === 'win32') {
      buildCommand = `cmd /c "set DOCKER_BUILDKIT=1&& docker build --platform=linux/amd64 --compress -t ${AWS_ECR_REPOSITORY}:${IMAGE_TAG} -f "${DOCKERFILE_PATH}" ."`;
    } else {
      buildCommand = `DOCKER_BUILDKIT=1 docker build --platform=linux/amd64 --compress -t ${AWS_ECR_REPOSITORY}:${IMAGE_TAG} -f ${DOCKERFILE_PATH} .`;
    }

    executeCommand(buildCommand, 'Error building Docker image');
    console.log('Docker image built successfully');
    
    // Log in to ECR
    console.log('\nLogging in to AWS ECR...');
    executeCommand(`aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com`,
      'Error logging in to ECR');
    console.log('Logged in to ECR');
    
    // Verify if the repository exists - Assuming repository already exists and not trying to create it
    console.log('\nVerifying if the ECR repository exists...');
    try {
      execSync(`aws ecr describe-repositories --repository-names ${AWS_ECR_REPOSITORY} --region ${AWS_REGION}`, { stdio: 'pipe' });
      console.log(`The ECR repository '${AWS_ECR_REPOSITORY}' exists.`);
    } catch (error) {
      console.warn(`WARNING: The ECR repository '${AWS_ECR_REPOSITORY}' does not exist or you don't have permission to access it.`);
      console.warn(`You need to have an existing repository named '${AWS_ECR_REPOSITORY}' to proceed.`);
      console.warn('Please use the AWS console to create the repository if it does not exist.');
      console.warn('If you believe the repository exists, check your permissions and AWS credentials.');
      
      // Ask user if they want to continue anyway
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Do you want to continue anyway? (yes/no): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Deployment canceled.');
        process.exit(1);
      }
      
      console.log('Continuing deployment...');
    }
    
    // Tag image
    console.log('\nTagging image for ECR...');
    const ecrRepositoryUri = `${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${AWS_ECR_REPOSITORY}`;
    executeCommand(`docker tag ${AWS_ECR_REPOSITORY}:${IMAGE_TAG} ${ecrRepositoryUri}:${IMAGE_TAG}`,
      'Error tagging the image');
    console.log('Image tagged successfully');
    
    // Push to ECR
    console.log('\nPushing image to ECR...');
    try {
      executeCommand(`docker push ${ecrRepositoryUri}:${IMAGE_TAG}`,
        'Error pushing the image to ECR');
      console.log('Image pushed successfully to ECR');
    } catch (error) {
      console.error('Failed to push image to ECR. This could be due to permission issues.');
      console.error('Check that your user has the following permissions:');
      console.error('  - ecr:InitiateLayerUpload');
      console.error('  - ecr:UploadLayerPart');
      console.error('  - ecr:CompleteLayerUpload');
      console.error('  - ecr:PutImage');
      process.exit(1);
    }
    
    // Update Lambda function if necessary
    if (UPDATE_LAMBDA) {
      console.log('\nUpdating Lambda function...');
      executeCommand('npx serverless deploy function -f playwrightTest', 
        'Error updating Lambda function');
      console.log('Lambda function updated successfully');
    }
    
    const endTime = new Date().getTime();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\nDeployment completed in ${duration.toFixed(2)} seconds`);
    console.log(`\nDeployment information:`);
    console.log(`- ECR repository: ${ecrRepositoryUri}`);
    console.log(`- Image tag: ${IMAGE_TAG}`);
    console.log(`- Full URI: ${ecrRepositoryUri}:${IMAGE_TAG}`);
    
    if (UPDATE_LAMBDA) {
      console.log(`\nYou can test the Lambda function with: npm run invoke`);
    } else {
      console.log(`\nTo update the Lambda function, run: UPDATE_LAMBDA=true node scripts/deploy-to-ecr.js`);
    }
    
  } catch (error) {
    console.error('Error in deployment process:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
