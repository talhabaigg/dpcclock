<?php

namespace App\Actions;

use Spatie\LaravelPasskeys\Actions\ConfigureCeremonyStepManagerFactoryAction;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;

class ConfigurePasskeyCeremonyAction extends ConfigureCeremonyStepManagerFactoryAction
{
    public function execute(): CeremonyStepManagerFactory
    {
        $csmFactory = parent::execute();

        // Allow localhost over HTTP for local development
        if (app()->environment('local')) {
            $csmFactory->setSecuredRelyingPartyId(['localhost']);
        }

        return $csmFactory;
    }
}
