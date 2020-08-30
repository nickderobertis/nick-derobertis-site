import pathlib
from typing import Tuple

from cryptography.hazmat.primitives import serialization as crypto_serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend as crypto_default_backend

OUT_FOLDER = pathlib.Path(__file__).parent


def _key_pair_name(env_name: str, public: bool = True) -> str:
    name = f"id_rsa.{env_name}"
    if public:
        name += ".pub"
    return name


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


def _write_ssh_keys_to_files(
    public: bytes, private: bytes, public_path: pathlib.Path, private_path: pathlib.Path
):
    public_path.write_bytes(public)
    private_path.write_bytes(private)


def create_ssh_keys(public_path: pathlib.Path, private_path: pathlib.Path):
    public, private = _create_ssh_key_bytes()
    _write_ssh_keys_to_files(public, private, public_path, private_path)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("env", help="Name of environment")
    parser.add_argument('-o', '--out-folder', default=OUT_FOLDER, help='Output folder')
    args = parser.parse_args()

    public_key_name = _key_pair_name(args.env, public=True)
    private_key_name = _key_pair_name(args.env, public=False)

    public_key_path = args.out_folder / public_key_name
    private_key_path = args.out_folder / private_key_name

    create_ssh_keys(public_key_path, private_key_path)
