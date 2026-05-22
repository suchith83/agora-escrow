import os
from circle.web3 import utils
from dotenv import load_dotenv

load_dotenv()

print("Registering entity secret ciphertext...")
print("API Key:", os.environ.get("CIRCLE_API_KEY", "Not found"))
print("Entity Secret:", os.environ.get("CIRCLE_ENTITY_SECRET", "Not found"))

result = utils.register_entity_secret_ciphertext(
  api_key=os.environ.get("CIRCLE_API_KEY", ""),
  entity_secret=os.environ.get("CIRCLE_ENTITY_SECRET", ""),
  recoveryFileDownloadPath="register",
)

print(result)