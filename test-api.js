const fs = require("fs");
const FormData = require("form-data");

async function testRobinhoodUpload() {
  try {
    // Read the test CSV file
    const csvContent = fs.readFileSync("test-robinhood.csv", "utf8");

    // Create form data
    const formData = new FormData();
    formData.append("file", Buffer.from(csvContent), {
      filename: "test-robinhood.csv",
      contentType: "text/csv",
    });

    // Make the API request
    const response = await fetch("http://localhost:3000/api/upload/robinhood", {
      method: "POST",
      body: formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    const result = await response.json();

    console.log("Response status:", response.status);
    console.log("Response body:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error testing API:", error);
  }
}

// Note: This test requires authentication, so it would need to be run
// in a browser context with proper authentication
console.log("To test the API:");
console.log("1. Start the development server: npm run dev");
console.log("2. Navigate to the dashboard in your browser");
console.log(
  "3. Use the RobinhoodUpload component to upload the test-robinhood.csv file"
);
console.log(
  "4. Check the browser console and network tab for the API response"
);
