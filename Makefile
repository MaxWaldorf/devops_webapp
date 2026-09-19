.PHONY: build check lint serve standalone docker run clean

build:      ## build dist/web and dist/standalone from src/
	python3 tools/build.py

check: build ## build, then verify web + standalone are in sync
	python3 tools/build.py --check

standalone: build ## the single-file local version -> dist/standalone/devops-lifecycle.html
	@echo dist/standalone/devops-lifecycle.html

lint: ## lint src/styles.css (stylelint) and src/index.html (html-validate); needs Node
	npm install --no-audit --no-fund --silent
	npx stylelint src/styles.css
	npx html-validate src/index.html

serve: build ## preview the web build at http://localhost:8080
	DATA_DIR=.data python3 tools/server.py --dir dist/web --port 8080

docker: ## build the container image
	docker build -t devops-lifecycle .

run: ## run the container at http://localhost:8080
	docker compose up --build

clean:
	rm -rf dist
