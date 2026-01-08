import type { Rule } from '../../core/types.js'
import { noTableWithoutPk } from './no-table-without-pk.js'
import { noFkWithoutIndex } from './no-fk-without-index.js'
import { requireRls } from './require-rls.js'
import { noSensitiveColumns } from './no-sensitive-columns.js'
import { noExtensionInPublic } from './no-extension-in-public.js'
import { noSecurityDefinerView } from './no-security-definer-view.js'
import { functionSearchPath } from './function-search-path.js'
import { authUsersExposed } from './auth-users-exposed.js'
import { multiplePermissivePolicies } from './multiple-permissive-policies.js'
import { policyExistsRlsDisabled } from './policy-exists-rls-disabled.js'
import { rlsEnabledNoPolicy } from './rls-enabled-no-policy.js'
import { duplicateIndex } from './duplicate-index.js'
import { rlsReferencesUserMetadata } from './rls-references-user-metadata.js'
import { banMaterializedViewPublic } from './ban-materialized-view-public.js'
import { banForeignTablePublic } from './ban-foreign-table-public.js'
import { rlsPolicyAlwaysTrue } from './rls-policy-always-true.js'

export const allRules: Rule[] = [
  noTableWithoutPk, noFkWithoutIndex, duplicateIndex,
  requireRls, policyExistsRlsDisabled, rlsEnabledNoPolicy, multiplePermissivePolicies, rlsPolicyAlwaysTrue, rlsReferencesUserMetadata,
  noSecurityDefinerView, functionSearchPath, authUsersExposed, banMaterializedViewPublic, banForeignTablePublic,
  noSensitiveColumns, noExtensionInPublic,
]

export const ruleMap = new Map<string, Rule>(allRules.map(r => [r.meta.id, r]))

export {
  noTableWithoutPk, noFkWithoutIndex, requireRls, noSensitiveColumns, noExtensionInPublic,
  noSecurityDefinerView, functionSearchPath, authUsersExposed, multiplePermissivePolicies,
  policyExistsRlsDisabled, rlsEnabledNoPolicy, duplicateIndex, rlsReferencesUserMetadata,
  banMaterializedViewPublic, banForeignTablePublic, rlsPolicyAlwaysTrue,
}
