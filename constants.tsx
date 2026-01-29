
import React from 'react';
import { FileItem } from './types';

export const INITIAL_FILES: FileItem[] = [
  {
    name: 'main.py',
    type: 'python',
    content: `import math

def calculate_average_load(load_list):
    # Dev-Mentor: Looking good!
    # Try using built-in functions for efficiency.
    total = 0
    for n in load_list:
        total += n
    avg = total / len(load_list)
    return math.ceil(avg)

data = [10, 24, 32, 45, 11]
print(f"Processing load: {calculate_average_load(data)}")`
  },
  {
    name: 'utils.py',
    type: 'python',
    content: `def format_result(val):
    return f"Result: {val}"`
  },
  {
    name: 'requirements.txt',
    type: 'text',
    content: `numpy==1.24.0
pandas==2.0.0`
  }
];

export const LOGO_SVG = (
  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="size-8 text-[#1152d4]">
    <path d="M42.1739 20.1739L27.8261 5.82609C29.1366 7.13663 28.3989 10.1876 26.2002 13.7654C24.8538 15.9564 22.9595 18.3449 20.6522 20.6522C18.3449 22.9595 15.9564 24.8538 13.7654 26.2002C10.1876 28.3989 7.13663 29.1366 5.82609 27.8261L20.1739 42.1739C21.4845 43.4845 24.5355 42.7467 28.1133 40.548C30.3042 39.2016 32.6927 37.3073 35 35C37.3073 32.6927 39.2016 30.3042 40.548 28.1133C42.7467 24.5355 43.4845 21.4845 42.1739 20.1739Z" fill="currentColor"></path>
  </svg>
);
