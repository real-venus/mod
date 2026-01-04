FROM mod:latest
COPY ./requirements.txt ./
RUN pip install -r ./requirements.txt
# install ganache
RUN npm install -g ganache-cli
# expose ganache port
EXPOSE 8545
# start ganache on container start