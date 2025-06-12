import { Metadata } from "next";
import Generator from "@/components/Generator/Generator";

export const metadata: Metadata = {
  title: "CSV to SQL Generator",
  description: "Parse CSV and generate SQL INSERT statement",
};

export default function Generate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-10 font-sans">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800">
          CSV to SQL Generator
        </h1>

        <p className="mt-3 text-lg sm:text-xl text-gray-600 max-w-2xl">
          Upload a NEM12 format CSV file to generate SQL INSERT statements for
          the meter readings.
        </p>

        <Generator />
      </main>
    </div>
  );
}
