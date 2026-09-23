import os
import unittest

os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-at-least-32-bytes")

from app.auth import Credentials, Registration, hash_password, verify_password
from pydantic import ValidationError


class AuthTests(unittest.TestCase):
    def test_login_accepts_reserved_fixture_domain(self):
        values = Credentials(email=" Owner@TaskFlow.Local ", password="Password123!")
        self.assertEqual(values.email, "owner@taskflow.local")

    def test_registration_keeps_strict_email_validation(self):
        with self.assertRaises(ValidationError):
            Registration(email="owner@taskflow.local", password="Password123!")

    def test_bcrypt_round_trip(self):
        password_hash = hash_password("Password123!")
        self.assertTrue(verify_password("Password123!", password_hash))
        self.assertFalse(verify_password("wrong-password", password_hash))

    def test_supabase_bcrypt_prefixes_are_recognized(self):
        password_hash = hash_password("Password123!")
        self.assertTrue(password_hash.startswith("$2b$"))
        self.assertFalse(verify_password("Password123!", "$argon2id$invalid"))


if __name__ == "__main__":
    unittest.main()
