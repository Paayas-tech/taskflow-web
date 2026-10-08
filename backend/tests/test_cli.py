import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-at-least-32-bytes")

from app.cli import main, reset_password
from app.auth import verify_password


class PasswordResetTests(unittest.TestCase):
    def test_reset_password_hashes_and_commits(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = ("user-123", "person@example.com")

        row = reset_password(connection, " Person@Example.com ", "Password123!")

        self.assertEqual(row, ("user-123", "person@example.com"))
        parameters = cursor.execute.call_args.args[1]
        self.assertIn("token_version = token_version + 1", cursor.execute.call_args.args[0])
        self.assertTrue(parameters[0].startswith("$2b$"))
        self.assertTrue(verify_password("Password123!", parameters[0]))
        self.assertEqual(parameters[1], "person@example.com")
        connection.commit.assert_called_once_with()

    def test_missing_user_rolls_back(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = None

        self.assertIsNone(reset_password(connection, "missing@example.com", "Password123!"))
        connection.rollback.assert_called_once_with()
        connection.commit.assert_not_called()

    def test_hidden_prompt_is_used_when_password_is_omitted(self):
        connection = MagicMock()
        connection.__enter__.return_value = connection
        with (
            patch.dict(os.environ, {"SYNC_DATABASE_URL": "postgresql://example"}),
            patch("app.cli.getpass.getpass", side_effect=["Password123!", "Password123!"]),
            patch("app.cli.psycopg.connect", return_value=connection),
            patch("app.cli.reset_password", return_value=("user-123", "person@example.com")),
            patch("builtins.print") as output,
        ):
            self.assertEqual(main(["reset-password", "person@example.com"]), 0)

        output.assert_called_with(
            "Password updated successfully for user user-123 (person@example.com)."
        )

    def test_password_validation_matches_auth_limit(self):
        connection = MagicMock()
        with self.assertRaisesRegex(ValueError, "at least 8"):
            reset_password(connection, "person@example.com", "short")


if __name__ == "__main__":
    unittest.main()
