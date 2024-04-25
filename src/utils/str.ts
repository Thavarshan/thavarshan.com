export function truncate(input: string, maxLength: number): string {
    if (input.length <= maxLength) {
        return input;
    } else {
        return input.substring(0, maxLength) + '...';
    }
}
