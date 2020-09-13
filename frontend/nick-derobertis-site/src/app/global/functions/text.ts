export function andJoin(arr: string[]): string {
  if (arr.length < 2) {
    return arr.join('');
  } else if (arr.length === 2) {
    return arr.join(' and ');
  }

  const commaJoined: string = arr.slice(0, -1).join(', ');
  const [lastItem] = arr.slice(-1);
  const andJoined = [commaJoined, lastItem].join(' and ');
  return andJoined;
}
