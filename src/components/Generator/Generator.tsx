"use client";

import Papa from "papaparse";
import { ChangeEvent, useState } from "react";
import "./styles.css";

// Define the structure for a meter reading record.
interface MeterReading {
  nmi: string;
  timestamp: string;
  consumption: number;
}

export default function Generator() {
  // State to hold the parsed meter reading records.
  const [records, setRecords] = useState<MeterReading[]>([]);
  // State to track if the application is currently processing a file.
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  // State to hold any error messages.
  const [error, setError] = useState<string | null>(null);
  // State to hold any error messages.
  const [file, setFile] = useState<File | null>(null);

  // This function is triggered when a file is selected by the user.
  const handleFileChange = () => {
    if (!file) return;

    // Reset state before processing a new file.
    setError(null);
    setLoading(true);

    let currentNMI = "";
    let intervalLength = 0;

    // Use Papa Parse to stream the CSV file for efficiency with large files.
    Papa.parse(file, {
      worker: true, // Use a web worker to avoid blocking the UI.
      chunkSize: 1,
      chunk: function (results: Papa.ParseResult<string[]>) {
        // The chunk of data from the CSV.
        const chunkRows = results.data;

        chunkRows.forEach((row) => {
          // Process '200' record to get NMI and interval length.
          if (row[0] === "200") {
            currentNMI = row[1];
            intervalLength = parseInt(row[8], 10);
          }

          // Process '300' record for consumption data.
          if (row[0] === "300" && currentNMI && intervalLength) {
            const dateStr = row[1]; // YYYYMMDD format
            // Pre-calculate the date part of the timestamp as it's constant for all intervals in this row.
            const datePrefix = `${dateStr.slice(0, 4)}-${dateStr.slice(
              4,
              6
            )}-${dateStr.slice(6, 8)}`;

            // Loop through consumption values in the row.
            for (let i = 2; i < row.length; i++) {
              const consumption = parseFloat(row[i]);
              if (!isNaN(consumption)) {
                const totalMinutesOffset = (i - 2) * intervalLength;
                const intervalHours = Math.floor(totalMinutesOffset / 60);
                const intervalMinutes = totalMinutesOffset % 60;

                const timestamp = `${datePrefix} ${String(
                  intervalHours
                ).padStart(2, "0")}:${String(intervalMinutes).padStart(
                  2,
                  "0"
                )}:00`;

                // Add the new record to our list.
                setRecords((prev) => [
                  ...prev,
                  {
                    nmi: currentNMI,
                    timestamp,
                    consumption,
                  },
                ]);
              }
            }
          }
        });
      },
      complete: function () {
        setLoading(false);
        setCompleted(true); // Stop the loading indicator.
      },
      error: function (err: Error) {
        // Handle any parsing errors.
        setError("Error parsing CSV file: " + err.message);
        setLoading(false);
      },
    });
  };

  const onCopy = () => {
    if (completed) {
      const generatedSql = records.map(
        (record) =>
          `INSERT INTO meter_readings (nmi, "timestamp", consumption) VALUES ('${record.nmi}', '${record.timestamp}', ${record.consumption});`
      );
      navigator.clipboard.writeText(generatedSql.join("\n"));
    }
  };

  return (
    <div className="grid">
      <div className="mt-8 w-full max-w-md justify-self-center">
        <div className="flex items-center bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <input
            data-testid="csv-file-input"
            type="file"
            accept=".csv"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFile(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleFileChange}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transform hover:scale-105 transition-transform duration-200"
            disabled={!file}
          >
            Generate
          </button>
        </div>
      </div>

      {loading && <p className="mt-8 text-blue-500">Processing...</p>}
      {error && <p className="mt-8 text-red-500">{error}</p>}

      {records.length > 0 && (
        <div className="mt-10 w-full max-w-4xl">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Generated SQL ({records.length} statements)
          </h2>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-20 py-4 font-semibold text-gray-600">
                      NMI
                    </th>
                    <th className="px-20 py-4 font-semibold text-gray-600">
                      Timestamp
                    </th>
                    <th className="px-20 py-4 font-semibold text-gray-600">
                      Consumption
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record, index) => (
                    <tr
                      key={index}
                      className="table-row"
                      style={{ animationDelay: `${(index % 100) * 10}ms` }}
                    >
                      <td className="px-20 p-4 text-gray-700 font-mono">
                        {record.nmi}
                      </td>
                      <td className="px-20 p-4 text-gray-700">
                        {record.timestamp}
                      </td>
                      <td className="px-20 p-4 text-gray-700 font-mono">
                        {record.consumption.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button
            onClick={onCopy}
            className="mt-6 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transform hover:scale-105 transition-transform duration-200"
            disabled={loading}
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}
