(defproject projects "0.9.0"
  :description "Standalone apps for the Akvo Flow Dashboard"
  :url "http://akvo.org/products/akvoflow/"

  :dependencies [[org.clojure/clojure "1.8.0"]
                 [org.clojure/clojurescript "1.9.456"]
                 [org.clojure/core.async "0.2.395"]
                 [org.omcljs/om "0.8.8"]
                 [cljsjs/react "15.4.2-2"]
                 [cljsjs/react-dom "15.4.2-2"]
                 [cljs-ajax "0.5.8"]
                 [sablono "0.7.7"]]

  :plugins [[lein-cljsbuild "1.1.5"]
            [lein-shell "0.5.0"]]

  :source-paths ["src"]

  :clean-targets ^{:protect false}  ["../../../GAE/war/admin/frames/users.html"
                                     "../../../GAE/war/admin/frames/users.js"
                                     "../../../GAE/war/admin/frames/out/"]

  :aliases {"copyhtml" ["shell" "./cp-html.sh"]
            "copyhtml-production" ["shell" "./cp-html.sh" "--production"]
            "build" ["do"
                     ["clean"]
                     ["copyhtml-production"]
                     ["cljsbuild" "once" "adv"]]
            "watch" ["do"
                     ["clean"]
                     ["copyhtml"]
                     ["cljsbuild" "auto" "dev"]]}

  :cljsbuild {
    :builds [{:id "dev"
              :source-paths ["src"]
              :compiler {
                :main org.akvo.flow.dashboard.users.core
                :output-to "../../../GAE/war/admin/frames/users.js"
                :output-dir "../../../GAE/war/admin/frames/out"
                :asset-path "out"
                :optimizations :none
                :source-map true}}
             {:id "adv"
              :source-paths ["src"]
              :compiler {
                :main org.akvo.flow.dashboard.users.core
                :output-to "../../../GAE/war/admin/frames/users.js"
                :optimizations :advanced}}]})
