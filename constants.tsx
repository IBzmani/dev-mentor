
import React from 'react';
import { FileItem } from './types';

export const INITIAL_FILES: FileItem[] = [
  {
    name: 'two_sum.py',
    type: 'python',
    content: `from typing import List

def two_sum(nums: List[int], target: int) -> List[int]:
    """
    Given an array of integers 'nums' and an integer 'target', return indices of the two numbers such that they add up to target.
    You may assume that each input would have exactly one solution, and you may not use the same element twice.
    You can return the answer in any order.

    Example:
    Input: nums = [2,7,11,15], target = 9
    Output: [0,1]
    Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
    """
    # TODO: Implement your solution here
    pass

# Test your solution visually by printing output
if __name__ == "__main__":
    result = two_sum([2, 7, 11, 15], 9)
    print(f"Result for [2, 7, 11, 15], 9: {result}")
`
  },
  {
    name: 'tests.py',
    type: 'python',
    content: `import unittest
from two_sum import two_sum

class TestTwoSum(unittest.TestCase):
    def test_example(self):
        self.assertEqual(sorted(two_sum([2, 7, 11, 15], 9)), [0, 1])

    def test_case_2(self):
        self.assertEqual(sorted(two_sum([3, 2, 4], 6)), [1, 2])
        
    def test_case_3(self):
        self.assertEqual(sorted(two_sum([3, 3], 6)), [0, 1])

if __name__ == '__main__':
    unittest.main(exit=False)`
  }
];

export const LOGO_SVG = (
  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="size-8 text-[#1152d4]">
    <path d="M42.1739 20.1739L27.8261 5.82609C29.1366 7.13663 28.3989 10.1876 26.2002 13.7654C24.8538 15.9564 22.9595 18.3449 20.6522 20.6522C18.3449 22.9595 15.9564 24.8538 13.7654 26.2002C10.1876 28.3989 7.13663 29.1366 5.82609 27.8261L20.1739 42.1739C21.4845 43.4845 24.5355 42.7467 28.1133 40.548C30.3042 39.2016 32.6927 37.3073 35 35C37.3073 32.6927 39.2016 30.3042 40.548 28.1133C42.7467 24.5355 43.4845 21.4845 42.1739 20.1739Z" fill="currentColor"></path>
  </svg>
);
