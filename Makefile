.PHONY: build check serve standalone docker run clean

build:      ## build dist/web and dist/standalone from src/
	python3 tools/build.py

check: build ## build, then verify web + standalone are in sync
	python3 tools/build.py --check

standalone: build ## the single-file local version -> dist/standalone/devops-lifecycle.html
	@echo dist/standalone/devops-lifecycle.html

serve: build ## preview the web build at http://localhost:8080
	python3 -m http.server 8080 -d dist/web

docker: ## build the container image
	docker build -t devops-lifecycle .

run: ## run the container at http://localhost:8080
	docker compose up --build

clean:
	rm -rf dist
