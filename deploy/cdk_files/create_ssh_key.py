import pathlib
from typing import Tuple

from cryptography.hazmat.primitives import serialization as crypto_serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend as crypto_default_backend

OUT_FOLDER = pathlib.Path(__file__).parent
PUBLIC_KEY_PATH = OUT_FOLDER / "id_rsa.pub"
PRIVATE_KEY_PATH = OUT_FOLDER / "id_rsa"


def _create_ssh_key_bytes() -> Tuple[bytes, bytes]:
    key = rsa.generate_private_key(
        backend=crypto_default_backend(), public_exponent=65537, key_size=2048
    )
    private_key = key.private_bytes(
        crypto_serialization.Encoding.PEM,
        crypto_serialization.PrivateFormat.PKCS8,
        crypto_serialization.NoEncryption(),
    )
    public_key = key.public_key().public_bytes(
        crypto_serialization.Encoding.OpenSSH, crypto_serialization.PublicFormat.OpenSSH
    )
    return public_key, private_key


def _write_ssh_keys_to_files(public: bytes, private: bytes):
    PUBLIC_KEY_PATH.write_bytes(public)
    PRIVATE_KEY_PATH.write_bytes(private)


def create_ssh_keys():
    public, private = _create_ssh_key_bytes()
    _write_ssh_keys_to_files(public, private)


if __name__ == "__main__":
    create_ssh_keys()
