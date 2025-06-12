import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import Generator from "./Generator";
import type { ParseConfig, ParseResult, ParseStepResult } from "papaparse";

// Mock papaparse
const mockPapaParse = vi.fn();
vi.mock("papaparse", () => ({
  default: {
    parse: mockPapaParse,
  },
}));

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
  writable: true,
});

describe("Generator Component", () => {
  let mockFile: File;

  beforeEach(() => {
    mockFile = new File(["col1,col2\nval1,val2"], "test.csv", {
      type: "text/csv",
    });
    // Reset mocks before each test
    mockPapaParse.mockReset();
    (navigator.clipboard.writeText as vi.Mock).mockClear();

    // Default mock implementation for Papa.parse
    // This can be overridden in specific tests if needed
    mockPapaParse.mockImplementation((_file, config) => {
      if (config.complete) {
        config.complete({
          data: [],
          errors: [],
          meta: { VITE_TEST_PATCH_ROOT: "." },
        });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders initial state correctly", () => {
    render(<Generator />);
    expect(screen.getByTestId("file-input")).tobei();
    const generateButton = screen.getByRole("button", { name: /generate/i });
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
    expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/error parsing csv file/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/generated sql/i)).not.toBeInTheDocument();
  });

  it("enables Generate button when a file is selected", () => {
    render(<Generator />);
    const fileInput = screen.getByTestId("file-input");
    const generateButton = screen.getByRole("button", { name: /generate/i });

    expect(generateButton).toBeDisabled();
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    expect(generateButton).not.toBeDisabled();
  });

  it("parses CSV successfully, displays results, and updates NMI and intervalLength", async () => {
    mockPapaParse.mockImplementation((_file, config: ParseConfig<string[]>) => {
      if (config.chunk) {
        // Simulate receiving a '200' record
        config.chunk(
          {
            data: [["200", "NMI123", "Q", "U", "S", "A", "E", "kWh", "30"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
        // Simulate receiving a '300' record
        config.chunk(
          {
            data: [["300", "20230101", "10.5", "20.0"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
      }
      if (config.complete) {
        config.complete({
          data: [],
          errors: [],
          meta: { VITE_TEST_PATCH_ROOT: "." },
        });
      }
    });

    render(<Generator />);
    const fileInput = screen.getByTestId("file-input");
    const generateButton = screen.getByRole("button", { name: /generate/i });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(generateButton);

    expect(screen.getByText(/processing.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/generated sql \(2 statements\)/i)
    ).toBeInTheDocument();
    // Check for NMI (from 200 record)
    const nmiCells = screen.getAllByText("NMI123");
    expect(nmiCells.length).toBeGreaterThanOrEqual(1); // NMI appears for each record row

    // Check for timestamps and consumption values (from 300 record)
    expect(screen.getByText("2023-01-01 00:00:00")).toBeInTheDocument(); // Interval 0 * 30min
    expect(screen.getByText("10.500")).toBeInTheDocument();
    expect(screen.getByText("2023-01-01 00:30:00")).toBeInTheDocument(); // Interval 1 * 30min
    expect(screen.getByText("20.000")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /copy to clipboard/i })
    ).toBeInTheDocument();
  });

  it("handles CSV parsing error", async () => {
    const errorMessage = "Test parsing error";
    mockPapaParse.mockImplementation((_file, config: ParseConfig<string[]>) => {
      if (config.error) {
        config.error(new Error(errorMessage), mockFile);
      }
    });

    render(<Generator />);
    const fileInput = screen.getByTestId("file-input");
    const generateButton = screen.getByRole("button", { name: /generate/i });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(generateButton);

    expect(screen.getByText(/processing.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(`Error parsing CSV file: ${errorMessage}`)
    ).toBeInTheDocument();
    expect(screen.queryByText(/generated sql/i)).not.toBeInTheDocument();
  });

  it("copies generated SQL to clipboard", async () => {
    mockPapaParse.mockImplementation((_file, config: ParseConfig<string[]>) => {
      if (config.chunk) {
        config.chunk(
          {
            data: [["200", "NMI456", "", "", "", "", "", "", "60"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
        config.chunk(
          {
            data: [["300", "20230202", "15.5"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
      }
      if (config.complete) {
        config.complete({
          data: [],
          errors: [],
          meta: { VITE_TEST_PATCH_ROOT: "." },
        });
      }
    });

    render(<Generator />);
    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/generated sql \(1 statements\)/i)
      ).toBeInTheDocument();
    });

    const copyButton = screen.getByRole("button", {
      name: /copy to clipboard/i,
    });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "INSERT INTO meter_readings (nmi, \"timestamp\", consumption) VALUES ('NMI456', '2023-02-02 00:00:00', 15.5);"
    );
  });

  it("handles CSV with no processable consumption data after a 200 record", async () => {
    mockPapaParse.mockImplementation((_file, config: ParseConfig<string[]>) => {
      if (config.chunk) {
        config.chunk(
          {
            data: [["200", "NMI789", "", "", "", "", "", "", "15"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
        config.chunk(
          {
            data: [["300", "20230303", "invalid", "data"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        ); // No valid numbers
      }
      if (config.complete) {
        config.complete({
          data: [],
          errors: [],
          meta: { VITE_TEST_PATCH_ROOT: "." },
        });
      }
    });

    render(<Generator />);
    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/generated sql/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/error parsing csv file/i)
    ).not.toBeInTheDocument(); // Should complete successfully but with 0 records
  });

  it("does not process 300 records if NMI or intervalLength is not set", async () => {
    mockPapaParse.mockImplementation((_file, config: ParseConfig<string[]>) => {
      if (config.chunk) {
        // No '200' record, or '200' record is malformed for intervalLength
        config.chunk(
          {
            data: [["300", "20230101", "10.5", "20.0"]],
            meta: { VITE_TEST_PATCH_ROOT: "." },
          } as ParseResult<string[]>,
          {} as any
        );
      }
      if (config.complete) {
        config.complete({
          data: [],
          errors: [],
          meta: { VITE_TEST_PATCH_ROOT: "." },
        });
      }
    });

    render(<Generator />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [mockFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() =>
      expect(screen.queryByText(/processing.../i)).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/generated sql/i)).not.toBeInTheDocument();
  });
});
