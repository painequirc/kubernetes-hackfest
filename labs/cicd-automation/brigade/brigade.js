const { events, Job, Group } = require('brigadier')

events.on("push", (brigadeEvent, project) => {
    
    // setup variables
    var acrServer = project.secrets.acrServer
    var acrName = project.secrets.acrName
    var azServicePrincipal = project.secrets.appId
    var azClientSecret = project.secrets.password
    var azTenant = project.secrets.tenant
    var gitPayload = JSON.parse(brigadeEvent.payload)
    var today = new Date()
    var gitSHA = brigadeEvent.revision.commit.substr(0,7)
    var branch = getBranch(gitPayload)    
    var imageTag = branch + "-" + gitSHA

    console.log(`==> gitHub webook on ${branch} branch with commit ID ${gitSHA}`)

    // setup brigade job to build container images
    var acr = new Job("job-runner-acr-builder")
    acr.storage.enabled = false
    acr.image = "microsoft/azure-cli:2.0.38"
    acr.tasks = [
        `az login --service-principal -u ${azServicePrincipal} -p ${azClientSecret} --tenant ${azTenant}`,
        //`az acr build -t hackfest/auth-api:${imageTag} -r ${acrName} --no-logs ./src/app/auth-api`,
        `az acr build -t hackfest/cache-api:${imageTag} -r ${acrName} --no-logs ./src/app/cache-api`,
        `az acr build -t hackfest/flights-api:${imageTag} -r ${acrName} --no-logs ./src/app/flights-api`,
        //`az acr build -t hackfest/web-ui:${imageTag} -r ${acrName} --no-logs ./src/app/web-ui`
    ]

       
    // setup brigade job for helm deployment
    var helm = new Job("job-runner-helm")
    helm.storage.enabled = false
    helm.image = "chzbrgr71/k8s-helm:v2.9.1"
    helm.tasks = [
        `helm upgrade --install cache-api ./src/charts/cache-api --reuse-values --set deploy.imageTag=${imageTag} --namespace default`
    ]

    // create a brigade group and run
    var pipeline = new Group()
    pipeline.add(acr)
    pipeline.add(helm)
    pipeline.runEach()

})

events.on("after", (event, proj) => {

    console.log("brigade pipeline finished successfully")
    
})

function getBranch (p) {
    if (p.ref) {
        return p.ref.substring(11)
    } else {
        return "PR"
    }
}