/**
 * Quicksort Algorithm Implementation in JavaScript
 *
 * This is an efficient, in-place sorting algorithm that uses divide-and-conquer.
 * Time Complexity: O(n log n) average, O(n²) worst case
 * Space Complexity: O(log n) average due to recursion stack
 *
 * @author FX Platform Team
 * @version 1.0.0
 */

/**
 * Main quicksort function - sorts an array in place
 * @param {Array} arr - The array to be sorted
 * @param {number} left - Left index (default: 0)
 * @param {number} right - Right index (default: arr.length - 1)
 * @returns {Array} The sorted array (same reference as input)
 */
function quickSort(arr, left = 0, right = arr.length - 1) {
    if (left < right) {
        // Partition the array and get the pivot index
        const pivotIndex = partition(arr, left, right);

        // Recursively sort elements before and after partition
        quickSort(arr, left, pivotIndex - 1);
        quickSort(arr, pivotIndex + 1, right);
    }

    return arr;
}

/**
 * Partition function - selects pivot and rearranges elements
 * Uses the last element as pivot (Lomuto partition scheme)
 * @param {Array} arr - The array to partition
 * @param {number} left - Left index
 * @param {number} right - Right index
 * @returns {number} The final pivot position
 */
function partition(arr, left, right) {
    // Choose the rightmost element as pivot
    const pivot = arr[right];

    // Index of smaller element
    let i = left - 1;

    // Traverse through all elements and compare with pivot
    for (let j = left; j < right; j++) {
        // If current element is smaller than or equal to pivot
        if (arr[j] <= pivot) {
            i++; // Move index of smaller element forward
            swap(arr, i, j);
        }
    }

    // Move pivot to its correct position
    swap(arr, i + 1, right);

    return i + 1;
}

/**
 * Utility function to swap two elements in an array
 * @param {Array} arr - The array
 * @param {number} i - First index
 * @param {number} j - Second index
 */
function swap(arr, i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
}

/**
 * Functional version of quicksort - returns new sorted array
 * Doesn't modify the original array
 * @param {Array} arr - The array to sort
 * @returns {Array} New sorted array
 */
function quickSortFunctional(arr) {
    if (arr.length <= 1) {
        return [...arr];
    }

    const pivot = arr[0];
    const left = [];
    const right = [];

    for (let i = 1; i < arr.length; i++) {
        if (arr[i] < pivot) {
            left.push(arr[i]);
        } else {
            right.push(arr[i]);
        }
    }

    return [...quickSortFunctional(left), pivot, ...quickSortFunctional(right)];
}

/**
 * Optimized quicksort with randomized pivot selection
 * Reduces chance of worst-case O(n²) performance
 * @param {Array} arr - The array to sort
 * @param {number} left - Left index
 * @param {number} right - Right index
 * @returns {Array} The sorted array
 */
function quickSortRandomized(arr, left = 0, right = arr.length - 1) {
    if (left < right) {
        // Randomly select pivot and move to end
        const randomPivotIndex = Math.floor(Math.random() * (right - left + 1)) + left;
        swap(arr, randomPivotIndex, right);

        const pivotIndex = partition(arr, left, right);

        quickSortRandomized(arr, left, pivotIndex - 1);
        quickSortRandomized(arr, pivotIndex + 1, right);
    }

    return arr;
}

/**
 * Utility function to check if array is sorted
 * @param {Array} arr - The array to check
 * @returns {boolean} True if sorted, false otherwise
 */
function isSorted(arr) {
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] > arr[i + 1]) {
            return false;
        }
    }
    return true;
}

// Example usage and test cases
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        quickSort,
        quickSortFunctional,
        quickSortRandomized,
        partition,
        swap,
        isSorted
    };

    // Run tests if executed directly
    if (require.main === module) {
        console.log('=== Quicksort Algorithm Tests ===');

        const testCases = [
            [64, 34, 25, 12, 22, 11, 90],
            [5, 4, 3, 2, 1],
            [1, 2, 3, 4, 5],
            [3, 7, 8, 5, 2, 1, 9, 5, 4],
            [],
            [42],
            [1, 1, 1, 1],
            [-3, -1, -7, -4, -2]
        ];

        testCases.forEach((testCase, index) => {
            console.log(`\nTest Case ${index + 1}:`);
            console.log('Original:', testCase);

            const sorted = quickSort([...testCase]);
            console.log('Sorted:', sorted);
            console.log('Is sorted:', isSorted(sorted));
        });

        // Performance test
        console.log('\n=== Performance Test ===');
        const largeArray = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 10000));

        console.time('Quicksort (10,000 elements)');
        quickSort([...largeArray]);
        console.timeEnd('Quicksort (10,000 elements)');
    }
} else {
    // Browser environment - attach to window object
    window.QuickSort = {
        quickSort,
        quickSortFunctional,
        quickSortRandomized,
        partition,
        swap,
        isSorted
    };

    // Simple demo in browser
    console.log('Quicksort loaded! Try: QuickSort.quickSort([64, 34, 25, 12, 22, 11, 90])');
}
