import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Generator from "./Generator";
import "@testing-library/jest-dom";
import Papa from "papaparse";

// Mock papaparse
jest.mock("papaparse", () => ({
  ...jest.requireActual("papaparse"), // Import and retain default behavior
  parse: jest.fn(), // Mock the parse function
}));

const mockParse = Papa.parse as jest.Mock;

describe("Generator Component", () => {
  beforeEach(() => {
    // Reset the mock before each test
    mockParse.mockReset();
  });

  test("should enable Generate button when a file is selected", async () => {
    const user = userEvent.setup();
    mockParse.mockImplementation((_file, config) => {
      // Simulate successful parsing completion for this specific test
      if (config.complete) {
        config.complete();
      }
    });
    render(<Generator />);

    // Find the Generate button and assert it's initially disabled
    const generateButton = screen.getByRole("button", { name: /generate/i });
    expect(generateButton).toBeDisabled();

    // Find the file input using the data-testid
    const fileInputElement = screen.getByTestId("csv-file-input");

    const mockFile = new File(["file content"], "test.csv", { type: "text/csv" });

    // Simulate file selection
    await user.upload(fileInputElement, mockFile);

    // Assert the Generate button is now enabled
    expect(generateButton).toBeEnabled();
  });

  test("should show processing message, then results table and copy button on successful generation", async () => {
    const user = userEvent.setup();
    mockParse.mockImplementation((_file, config) => {
      // Simulate chunk processing
      if (config.chunk) {
        // Simulate a '200' record
        config.chunk({ data: [["200", "NMI123", "", "", "", "", "", "", "30"]] }, { meta: {} });
        // Simulate a '300' record
        config.chunk({ data: [["300", "20230101", "10.5", "11.5"]] }, { meta: {} });
      }
      // Simulate successful parsing completion
      if (config.complete) {
        config.complete();
      }
    });

    render(<Generator />);

    const generateButton = screen.getByRole("button", { name: /generate/i });
    const fileInputElement = screen.getByTestId("csv-file-input");
    const mockFile = new File(["200,NMI123,,,,,,,30\n300,20230101,10.5,11.5"], "test.csv", { type: "text/csv" });

    await user.upload(fileInputElement, mockFile);
    await user.click(generateButton);

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText(/generated sql \(2 statements\)/i)).toBeInTheDocument();
    });

    // Check for table headers
    expect(screen.getByRole("columnheader", { name: /nmi/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /timestamp/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /consumption/i })).toBeInTheDocument();

    // Check for table content (example from mocked data)
    expect(screen.queryAllByText("NMI123")).toHaveLength(2);
    expect(screen.getByText("2023-01-01 00:00:00")).toBeInTheDocument();
    expect(screen.getByText("10.500")).toBeInTheDocument();
    expect(screen.getByText("2023-01-01 00:30:00")).toBeInTheDocument();
    expect(screen.getByText("11.500")).toBeInTheDocument();

    // Check for copy button
    expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeInTheDocument();

    // Processing message should disappear
    expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
  });

  test("should display an error message if CSV parsing fails", async () => {
    const user = userEvent.setup();
    const errorMessage = "Test parsing error";
    mockParse.mockImplementation((_file, config) => {
      // Simulate a parsing error
      if (config.error) {
        config.error(new Error(errorMessage));
      }
    });

    render(<Generator />);

    const generateButton = screen.getByRole("button", { name: /generate/i });
    const fileInputElement = screen.getByTestId("csv-file-input");
    const mockFile = new File(["invalid,csv,data"], "test.csv", { type: "text/csv" });

    await user.upload(fileInputElement, mockFile);
    await user.click(generateButton);

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(`Error parsing CSV file: ${errorMessage}`)).toBeInTheDocument();
    });

    // Processing message should disappear
    expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
    // Results table should not be present
    expect(screen.queryByText(/generated sql/i)).not.toBeInTheDocument();
  });
});
