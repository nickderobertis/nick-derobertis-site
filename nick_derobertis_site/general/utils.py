from typing import Sequence

PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAHd3dwAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='


def and_join(items: Sequence[str]) -> str:
    if len(items) < 2:
        return ''.join(items)
    if len(items) == 2:
        return ' and '.join(items)

    comma_join = ', '.join(items[:-1])
    return ', and '.join([comma_join, items[-1]])
