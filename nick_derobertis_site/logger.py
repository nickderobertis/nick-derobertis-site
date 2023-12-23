import logging
import sys


class CustomFormatter(logging.Formatter):
    debug_formatter = logging.Formatter(
        "%(asctime)s: %(name)s - %(filename)s L%(lineno)s - %(levelname)s - %(message)s"
    )
    other_formatter = logging.Formatter("[%(name)s %(levelname)s]: %(message)s")

    def format(self, record: logging.LogRecord) -> str:
        if record.levelno <= logging.DEBUG:
            return self.debug_formatter.format(record)
        return self.other_formatter.format(record)


logger = logging.getLogger("nick_derobertis_site")
logger.setLevel(logging.INFO)

ch = logging.StreamHandler(stream=sys.stdout)
ch.setLevel(logging.DEBUG)
ch.setFormatter(CustomFormatter())
logger.addHandler(ch)
