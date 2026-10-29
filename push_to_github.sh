#!/bin/bash
cd "$(dirname "$0")"

echo "Initializing Git repository..."
git init
git branch -M main

git remote remove origin 2>/dev/null
git remote add origin https://github.com/rajeshn-tech/Kaalvan_REA.git

echo "Staging files..."
git add .

echo "Committing..."
git commit -m "feat: initial backup of REA and OpenComp VFX workstation"

echo "Pushing to GitHub..."
git push -u origin main || git push -u origin main --force

echo "Done!"

