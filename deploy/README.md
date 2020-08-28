
# Initial Setup

## Environment Variables

Copy `.env.template` to `.env` and fill in the values.

# Notes

Everything is meant to be run with the working directory in
the deploy folder so you may need to `cd deploy`.

# First Deployment

Run `./initial-deploy.sh`

## Linux-Only Steps

If you are on Linux, 
after this step, outside of docker, you should run 
`sudo chown -R $USER deploy-cdk/`. This is only necessary
the first time after the `deploy-cdk` folder is generated.

# Delete Deployment

Run `./delete-deploy.sh`