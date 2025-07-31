import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { ensureDirectoriesExist } from "./utils";
import {
  BROWSER_ARGS,
  VIEWPORT,
  USER_AGENT,
  TIMEOUT_NAVIGATION,
  TIMEOUT_SELECTOR,
  PARAMETERS,
  VALIDATION_SELECTORS,
} from "./utils/constants";
import { validateElement } from "./utils/validateElement";

/**
 * AWS Lambda handler function for automated web screenshot capture and S3 storage.
 *
 * This function automates the process of taking screenshots of specific web elements
 * using Playwright in a serverless AWS Lambda environment. It navigates to the Aegean Air
 * flights booking page, captures a screenshot of the flight booking component, and uploads
 * it to an S3 bucket for storage and retrieval.
 *
 * @description
 * The handler performs the following operations:
 * 1. Initializes a headless Chromium browser instance optimized for Lambda
 * 2. Navigates to the target URL (Aegean Air flights page)
 * 3. Waits for the specific flight booking component to load
 * 4. Captures a screenshot of the target element
 * 5. Uploads the screenshot to AWS S3 with a timestamped filename
 * 6. Returns the S3 URL and operation status
 *
 * @param {APIGatewayProxyEvent} event - The API Gateway event object containing:
 *   - httpMethod: The HTTP method used for the request
 *   - headers: Request headers including authorization and content-type
 *   - queryStringParameters: URL query parameters (optional)
 *   - body: Request body content (optional)
 *   - pathParameters: Path parameters from the URL (optional)
 *   - requestContext: Additional request context from API Gateway
 *
 * @param {Context} [context] - Optional AWS Lambda context object containing:
 *   - functionName: Name of the Lambda function
 *   - functionVersion: Version of the Lambda function
 *   - invokedFunctionArn: ARN of the invoked function
 *   - memoryLimitInMB: Memory limit configured for the function
 *   - remainingTimeInMillis: Remaining execution time
 *   - logGroupName: CloudWatch log group name
 *   - logStreamName: CloudWatch log stream name
 *   - awsRequestId: Unique request identifier
 *
 * @returns {Promise<APIGatewayProxyResult>} A promise that resolves to an API Gateway response object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for errors)
 *   - headers: Response headers including Content-Type
 *   - body: JSON stringified response body with:
 *     - message: Success or error message
 *     - timestamp: ISO timestamp of the operation
 *     - screenshotUrl: S3 URL of the captured screenshot (on success)
 *     - event: Original event object for debugging
 *
 * @throws {Error} Throws various errors that are caught and returned as 500 responses:
 *   - Browser launch failures due to Lambda environment constraints
 *   - Navigation timeouts when the target page fails to load
 *   - Element not found errors when the flight booking component is missing
 *   - File system errors during screenshot saving
 *   - S3 upload failures due to permissions or network issues
 *
 * @example
 * // Example successful response
 * {
 *   statusCode: 200,
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     message: "Success",
 *     timestamp: "2024-01-15T10:30:45.123Z",
 *     screenshotUrl: "https://technical-playwright-result.s3.amazonaws.com/screenshots/aegean-flight-booking-2024-01-15T10-30-45-123Z.png",
 *     event: { ... }
 *   })
 * }
 *
 * @example
 * // Example error response
 * {
 *   statusCode: 500,
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     message: "Error: Flight booking component not found",
 *     timestamp: "2024-01-15T10:30:45.123Z",
 *     screenshotUrl: null,
 *     event: { ... }
 *   })
 * }
 *
 * @requires playwright-core - For browser automation
 * @requires @sparticuz/chromium - Chromium binary optimized for Lambda
 * @requires @aws-sdk/client-s3 - AWS S3 client for file uploads
 *
 * @environment
 * Required environment variables:
 * - AWS_REGION: AWS region for S3 operations (defaults to 'us-east-2')
 * - AWS_S3_BUCKET: S3 bucket name for screenshot storage (defaults to 'technical-playwright-result')
 *
 * @performance
 * - Average execution time: 15-30 seconds (depending on page load time)
 * - Memory usage: ~512MB recommended minimum
 * - Timeout: Configure Lambda timeout to at least 60 seconds
 *
 * @security
 * - Requires appropriate IAM permissions for S3 PutObject operations
 * - Screenshots are stored with public read access via S3 URLs
 * - No sensitive data should be captured in screenshots
 *
 * @version 1.0.0
 * @since 2025-07-24
 * @author a11ySolutions Development Team
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context?: Context
): Promise<APIGatewayProxyResult> => {
  let browser: any = null;
  let screenshotUrl: string | null = null;
  let statusCode = 200;
  let message = "Success";

  let journeyTypeDivResult: any = null;
  let travelerInfoDivResult: any = null;
  let promoCodeDivResult: any = null;
  let originFieldResult: any = null;
  let startDateTogglerResult: any = null;
  let endDateTogglerResult: any = null;
  let searchButtonResult: any = null;

  let totalInteractiveElements: any[] = [];
  let accessibleElements: any[] = [];
  let interactiveElements: any[] = [];

  try {
    // Ensure necessary directories exist
    await ensureDirectoriesExist();

    // Launch browser with configuration suitable for Lambda
    browser = await playwright.launch({
      args: BROWSER_ARGS,
      executablePath: await chromium.executablePath(),
    });

    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: USER_AGENT,
    });

    const page = await context.newPage();

    // Configure timeouts longer for Lambda environment
    page.setDefaultNavigationTimeout(TIMEOUT_NAVIGATION);

    // Navigate to Aegean Air page
    await page.goto(PARAMETERS.url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_NAVIGATION,
    });

    // Wait for the specific selector to be visible
    await page.waitForSelector(PARAMETERS.selector, {
      state: "visible",
      timeout: TIMEOUT_SELECTOR,
    });

    // Take screenshot of the specific element
    const element = await page.$(PARAMETERS.selector);

    if (!element) {
      throw new Error("Flight booking component not found");
    }

    const screenshotPath = "/tmp/screenshots/flight-booking-component.png";
    await element.screenshot({ path: screenshotPath });

    // Upload screenshot to S3
    const bucketName = process.env.AWS_S3_BUCKET || 'technical-playwright-result';
    const fileName = `aegean-flight-booking-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const s3Key = `screenshots/${fileName}`;

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-2'
    });

    const screenshotBuffer = await fs.readFile(screenshotPath);

    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: screenshotBuffer,
      ContentType: 'image/png',
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    screenshotUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;

    journeyTypeDivResult = await validateElement(
      page,
      VALIDATION_SELECTORS.journeyTypeDiv,
      "Journey type selector",
      'button[role="combobox"], button[aria-haspopup="listbox"], button',
      { type: "click", expectStateChange: true }
    );

    travelerInfoDivResult = await validateElement(
      page,
      VALIDATION_SELECTORS.travelerInfoDiv,
      "Traveler info selector",
      'button[role="combobox"], button[aria-haspopup="listbox"], button'
    );

    promoCodeDivResult = await validateElement(
      page,
      VALIDATION_SELECTORS.promoCodeDiv,
      "Promo code section",
      'input[type="text"], input'
    );

    originFieldResult = await validateElement(
      page,
      VALIDATION_SELECTORS.originField,
      "Origin field",
      'input[type="text"], input, button[role="combobox"]',
      { type: "focus" }
    );

    startDateTogglerResult = await validateElement(
      page,
      VALIDATION_SELECTORS.startDateToggler,
      "Start date selector",
      'button, input[type="date"], input'
    );

    endDateTogglerResult = await validateElement(
      page,
      VALIDATION_SELECTORS.endDateToggler,
      "End date selector",
      'button, input[type="date"], input'
    );

    searchButtonResult = await validateElement(
      page,
      VALIDATION_SELECTORS.searchButton,
      "Search button",
      undefined,
      { type: "hover" }
    );

    const allElementsFound =
      journeyTypeDivResult.found &&
      travelerInfoDivResult.found &&
      promoCodeDivResult.found &&
      originFieldResult.found &&
      startDateTogglerResult.found &&
      endDateTogglerResult.found &&
      searchButtonResult.found;
    totalInteractiveElements = [
      journeyTypeDivResult,
      travelerInfoDivResult,
      promoCodeDivResult,
      originFieldResult,
      startDateTogglerResult,
      endDateTogglerResult,
      searchButtonResult
    ].filter(result => result.childFound || result.found);

    accessibleElements = totalInteractiveElements.filter(result =>
      (result.childDetails?.hasValidSemantics || result.details?.hasValidSemantics) &&
      (result.childDetails?.accessibleName || result.details?.accessibleName)
    );

    interactiveElements = totalInteractiveElements.filter(result =>
      result.interactionResult?.success
    );

    message = allElementsFound
      ? `Success - Screenshot captured, ${totalInteractiveElements.length} elements found, ${accessibleElements.length} accessible, ${interactiveElements.length} interactive`
      : "Success - Screenshot captured but one or more elements NOT found";

  } catch (error: any) {
    console.error("Error:", error);
    console.error("Stack trace:", error.stack);
    statusCode = 500;
    message = `Error: ${error.message}`;
  } finally {
    // Close browser if it was opened
    if (browser) {
      try {
        await browser.close();
      } catch (closeError: any) {
        console.error("Error closing browser:", closeError);
      }
    }
  }

  const responseBody = JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      screenshotUrl,
      accessibilityReport: {
        totalElements: totalInteractiveElements?.length || 0,
        accessibleElements: accessibleElements?.length || 0,
        interactiveElements: interactiveElements?.length || 0,
        accessibilityScore: totalInteractiveElements?.length > 0
          ? Math.round((accessibleElements?.length / totalInteractiveElements.length) * 100)
          : 0,
      },
      divTests: {
        journeyTypeDiv: journeyTypeDivResult,
        travelerInfoDiv: travelerInfoDivResult,
        promoCodeDiv: promoCodeDivResult,
        originField: originFieldResult,
        startDateToggler: startDateTogglerResult,
        endDateToggler: endDateTogglerResult,
        searchButton: searchButtonResult,
      },
      event,
    })

  // Create response with URL of the screenshot if it was successful
  const response: APIGatewayProxyResult = {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: responseBody
  };
  console.log("Formatted Response:", responseBody )
  return response;
};
