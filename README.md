# 🧪 Technical Test - Playwright + AWS Lambda

Coding exercise for candidates: Automated testing for a flight booking component using Playwright, AWS, serverless Framework, Docker, and Typescript.

## 🧠 Objective
- Implement the missing tests according to the **Testing Requirements** section.
- Set up automatic according to the **Implement automatic deployment using GitHub Actions** section.
- Include in the lambda response the results of each step, including screenshots, execution times, and any other relevant information for later analysis of the results.

## ✅ Testing Requirements

#### **Playwright Tests (`src/index.ts`)**
- ✅ Successfully navigate to the Aegean Air website
- ✅ Locate the `div[data-em-cmp="flights-booking"]` component
- ✅ Capture a screenshot of the specific component
- ✅ Validate booking form elements:
  - Trip type selector (Round-trip/One-way)
  - Passengers and class selector
  - Origin and destination fields
  - Departure and return date selectors
  - Search button

## ✅ Implement automatic deployment using GitHub Actions
  - Create a GitHub Actions workflow to build and deploy the lambda
  - Environment variables are stored in GitHub environment: `automation`

## 🧰 Technical Features

- **TypeScript**: Fully typed code for better maintainability
- **Playwright**: Modern and reliable web automation
- **AWS Lambda**: Scalable serverless execution
- **Docker**: Containerization for consistency across environments
- **S3 Integration**: Automatic screenshot storage
- **ECR**: Docker container registry in AWS
- **GitHub Actions**: Automatic CI/CD

## 📋 Prerequisites

- Node.js 18+
- Docker
- Configured AWS CLI
- AWS credentials with permissions for Lambda, ECR, and S3

## ⚙️ Initial Setup

### 1. Install Dependencies

```bash
npm install
```
### 2. Configure Environment Variables

Create `.env` and add the required variables

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_ECR_REPOSITORY=
AWS_S3_BUCKET=
AWS_LAMBDA_FUNCTION_NAME=
AWS_ACCOUNT_ID=
AWS_ROLE_ARN=
AWS_ECR_REPOSITORY_URL=
IMAGE_TAG=
PREFIX=
```

## 🚀 AWS Deployment

### 1. Deploy to ECR

```bash
npm run deploy:ecr
```

### 2. Deploy Lambda with Serverless

```bash
npm run deploy
```
## 🚀 Local Testing

```bash
npm run invoke
```

## 📁 Project Structure

```
├── src/
│   ├── index.ts          # Main Lambda function (TypeScript)
│   └── utils/
│       ├── index.ts      # Utility functions
│       └── constants.ts  # Configuration constants
├── scripts/
│   └── deploy-to-ecr.js  # ECR deployment script
├── Dockerfile            # Docker image for Lambda
├── serverless.yml        # Serverless configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
├── package-lock.json     # Exact dependency versions
├── .env                  # Environment variables
└── README.md             # Project documentation
```

## 🎯 Functionality

The Lambda function:

1. **Navigates** to the Aegean Air flights page
2. **Locates** the booking component `div[data-em-cmp="flights-booking"]`
3. **Captures** a screenshot of the component
4. **Uploads** the image to S3
5. **Returns** the image URL

### Tested Components

- Trip type selector (Round-trip/One-way)
- Passengers and class selector
- Origin and destination fields
- Departure and return date selectors
- Search button

## 📜 Available Scripts

```bash
# Development
npm run build          # Compile TypeScript
npm run build:clean    # Clean and compile
npm run dev            # Watch mode

# Deployment
npm run deploy:ecr     # Upload image to ECR
npm run deploy         # Deploy Lambda
npm run remove         # Remove stack

# Lambda
npm run invoke         # Invoke function
```

## 📝 Notes
- You are **encouraged** to use AI tools, the internet, or any form of external help.
- There are **no restrictions** – you may create any files, folders, or install any npm packages you feel are helpful.
- Just be prepared to **discuss and defend your implementation decisions** in a follow-up conversation.

## 🤝 Submission Instructions

### Steps to Complete the Test:

1. **Fork** this repository
2. **Implement** all required tests
3. **Configure** GitHub Actions workflow
4. **Document** changes and decisions
5. **Create Pull Request** with your solution
6. **Verify** that automatic deployment works


**Good luck with your implementation! 🚀**

## 🛠️ Additional Implementations

### 1. **Element-Specific Tests**
- Added automated tests for each element of the flight booking form component on the Aegean Air page. These tests validate:
  - **Trip Type Selector**: Ensures the dropdown for selecting "Round-trip" or "One-way" is functional and accessible.
  - **Traveler Info Selector**: Verifies the dropdown for selecting passengers and class is interactive and meets accessibility standards.
  - **Promo Code Section**: Checks the input field for entering promotional codes is present and functional.
  - **Origin Field**: Validates the input field for selecting the origin location is accessible and interactive.
  - **Start Date Selector**: Ensures the date picker for departure dates is functional and accessible.
  - **End Date Selector**: Verifies the date picker for return dates is interactive and meets accessibility standards.
  - **Search Button**: Confirms the search button is visible, interactive, and accessible.

Each test captures detailed results, including:
- Accessibility attributes (e.g., `aria-label`, `role`).
- Interaction results (e.g., clicks, focus, hover).
- DOM changes after interactions (e.g., dropdowns, modals).

### 2. **Automated GitHub Actions Workflow**
- Implemented a fully automated CI/CD pipeline using GitHub Actions. The workflow includes:
  - **Dependency Installation**: Installs all required Node.js dependencies.
  - **Build Process**: Compiles the TypeScript code into JavaScript.
  - **ECR Deployment**: Builds and pushes the Docker image to AWS Elastic Container Registry (ECR).
  - **Lambda Deployment**: Deploys the Lambda function using the Serverless Framework.
  - **Function Invocation**: Invokes the Lambda function and displays the result directly in the GitHub Actions logs.
  - **Result Formatting**: Ensures the Lambda function's response is properly formatted for readability, including JSON structure and indentation.

This automation ensures a seamless deployment and testing process, reducing manual effort and improving the clarity of the results.
