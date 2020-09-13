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

export function numberWithCommas(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function numberWithCommasAndKM(x: number): string {
  let endChar = '';
  if (x > 1000000) {
    x /= 100000;
    x = Math.round(x);
    x /= 10;
    endChar = 'M';
  } else if (x > 1000) {
    x /= 100;
    x = Math.round(x);
    x /= 10;
    endChar = 'K';
  }
  const withCommas: string = numberWithCommas(x);
  return withCommas + endChar;
}
