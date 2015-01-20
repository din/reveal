(function($)
{
    function dragonise(el, options)
    {
        options = $.extend({ "press" : null, "move" : null, "release" : null }, options);

        el.on("mousedown touchstart", function(ev_initial)
        {
            if (options.press) options.press.call(el);

            //Attaching events listeners
            $(document).on("mousemove.dragonise touchmove.dragonise", function(ev)
            {
                ev.preventDefault();

                var data = {};

                //Storing deltas relative to the first mouse press or touch
                if (ev.type == "mousemove")
                {
                    data.dx = ev_initial.pageX - ev.pageX;
                    data.dy = ev_initial.pageY - ev.pageY;
                }
                else
                {
                    data.dx = ev_initial.originalEvent.targetTouches[0].pageX - ev.originalEvent.targetTouches[0].pageX;
                    data.dy = ev_initial.originalEvent.targetTouches[0].pageY - ev.originalEvent.targetTouches[0].pageY;
                }

                //Storing absolute values for our deltas
                data.adx = Math.abs(data.dx);
                data.ady = Math.abs(data.dy);

                data.direction = { x : data.dx >= 0 ? 1 : -1,
                                   y : data.dy >= 0 ? 1 : -1 };

                //Calling movement handler
                if (options.move) options.move.call(el, data);

            }).on("mouseup.dragonise touchend.dragonise", function(ev)
            {
                $(document).off(".dragonise");
                if (options.release) options.release.call(el);
            });  
        })
    }

    function appendRevealActions(raw_actions, defaults)
    {
        /* Preparing input values */

        if (typeof raw_actions !== "object") throw "Invalid input parameters";
        if (typeof defaults === "function") { callback = defaults; defaults = {}; }
        if (typeof defaults === "undefined") defaults = {};

        var actions = $.extend({"left" : [], "right" : [], "top" : [], "bottom" : []}, raw_actions);

        //Actions can be specified as an array of values or as a single string, if there is only a single action
        //Actions can also be objects instead of strings, and they will be attached properly
        for (var attachment in actions)
        {
            actions[attachment] = typeof actions[attachment] === "string" ? [actions[attachment]] : actions[attachment];
        }

        //See documentation for the detailed description of the values below
        defaults = $.extend({"complete" : null,
                             "cancel" : null,
                             "activation_threshold" : 0.4, 
                             "offscreen_element_size" : 0.5,
                             "action_element_size" : 0.5,
                             "action_css_prefix" : "reveal-action-" }, defaults);

        //Orientation is detected automatically
        if ((actions.left.length == 0 && actions.right.length == 0) &&
            (actions.top.length > 0 || actions.bottom.length > 0))
        { 
            defaults["orientation"] = "v";
        }
        else
        {
            defaults["orientation"] = "h";
        }

        //UI elements to be created
        var ui = {
            el : $(this),
            wrapper : null,
            offscreen : null,
            label : null,
        };

        //Data storage
        var model = {
            accept_events : true,
            has_threshold : false,
            current_action : null,
            current_attachment : null,
            previous_action : null
        };

        //Marking the root element as ours
        //This class prevents text to be selected inside the element
        ui.el.addClass("reveal-root");

        /* Handling gestures */

        dragonise(ui.el, {"press" : function() 
        {
            if (model.accept_events == false) return;

            ui.el.contents().wrapAll("<div class='reveal-content'></div>"); 
            ui.el.append("<div class='reveal-offscreen'><strong class='reveal-label'></strong></div>");

            ui.wrapper = $(".reveal-content", ui.el).stop(true, true);;
            ui.offscreen = $(".reveal-offscreen", ui.el);
            ui.label = $("strong", ui.offscreen);

            //Preventing mouse cursor to be changed
            $("body, html").addClass("reveal-body");

            //Resetting previous model values for actions and attachments
            model.current_action = null;
            model.current_attachment = null;
            model.previous_action = null;

            //Checking if we need to unfold attachment function for the current element
            for (var attachment in raw_actions)
            {
                if (typeof raw_actions[attachment] === "function")
                {
                    actions[attachment] = raw_actions[attachment].call(ui.el[0]);
                    actions[attachment] = typeof actions[attachment] === "string" ? [actions[attachment]] : actions[attachment];
                }
            }

        }, "release" : function() 
        {
            if (model.accept_events == false || ui.offscreen == null) return;

            //Storing elements, because we delete them globally before animation finishes
            var wrapper = ui.wrapper, offscreen = ui.offscreen;  

            //Checking if we need a special transition if user selected an action
            if (model.current_action == null)
            {
                //No action selected, just returning the element to its initial state
                var animation = defaults.orientation == "h" ? { "width": 0 } : { "height": 0 };
                offscreen.animate(animation, {duration: 800, easing: "easeOutElastic", queue: false});

                wrapper.animate({"left" : 0, "top" : 0}, 
                                {duration: 800, easing: "easeOutElastic", queue: false, complete: function()
                {
                    //Calling a callback if we must
                    if (typeof defaults.cancel === "function")
                    {
                        defaults.cancel({"element" : ui.el});
                    }

                    offscreen.remove();
                    wrapper.contents().unwrap();
                }});  

                model.current_action = null;
                model.current_attachment = null;
                model.previous_action = null;
            }
            else
            {
                model.accept_events = false;

                //Creating the animation according to the attachment of the current action
                var animation = {}, duration = 330;
                switch (model.current_attachment)
                {
                    case "right": animation = { "left": -wrapper.width() }; break;
                    case "left": animation = { "left": wrapper.width() }; break;
                    case "top": animation = { "top": wrapper.height() }; break;
                    case "bottom": animation = { "top": -wrapper.height() }; break;
                }

                //Setting proper offscreen size
                if (model.current_attachment == "top" || model.current_attachment == "bottom")
                {
                    offscreen.animate({ "width": ui.el.innerWidth(), 
                                        "height" : ui.el.innerHeight() }, duration);
                }
                else
                {
                     offscreen.animate({ "width": ui.el.innerWidth(), 
                                        "height" : ui.el.innerHeight() }, duration);
                }

                //Executing the animation
                wrapper.animate(animation,
                                {duration : duration, easing : "easeOutCubic", complete : function()
                {

                    //Fading out user's choise after a short delay
                    setTimeout(function()
                    {
                        offscreen.fadeOut(150, function()
                        {
                             //Calling a callback if we must
                            if (typeof defaults.complete === "function")
                            {
                                defaults.complete({"action" : model.current_action, 
                                                   "attachment" : model.current_attachment,
                                                   "element" : ui.el, 
                                                   "wrapper" :wrapper});
                            }

                            model.current_action = null;
                            model.current_attachment = null;
                            model.previous_action = null;

                            offscreen.remove();
                            wrapper.contents().unwrap();

                            model.accept_events = true;
                        });
                    }, 300);
                }});
            }

            $("body, html").removeClass("reveal-body");

            ui.wrapper = null;
            ui.offscreen = null;
            ui.label = null;
                      
        }, "move" : function(data) 
        { 
            if (model.accept_events == false || ui.offscreen == null) return;                 

            var offset = defaults.orientation == "h" ? data.dx : data.dy, 
                raw_offset = offset,
                direction = data.direction[defaults.orientation == "h" ? "x" : "y"],
            
                element_size = defaults.orientation == "h" ? ui.el.width() : ui.el.height(),

                action_element_size = defaults.action_element_size <= 1 
                                        ? defaults.action_element_size * element_size 
                                        : defaults.action_element_size,
               
                offscreen_element_size = defaults.offscreen_element_size <= 1 
                                        ? element_size * defaults.offscreen_element_size 
                                        : defaults.offscreen_element_size,

                activation_threshold = defaults.activation_threshold <= 1 
                                        ? element_size * defaults.activation_threshold 
                                        : defaults.activation_threshold,

                threshold_changed = (model.has_threshold != (Math.abs(offset) >= activation_threshold)),

                attachment = defaults.orientation == "h" ? (direction > 0 ? "right" : "left") 
                                                         : (direction < 0 ? "top" : "bottom"),
                
                current_actions = actions[attachment];

            //We must save this to optimise further DOM operations
            model.has_threshold = Math.abs(offset) >= activation_threshold;

            //Applying constraints
            if (current_actions.length == 0) offset = 0;
            if (Math.abs(offset) < 0) offset = 0;
            if (Math.abs(offset) > offscreen_element_size) offset = direction * offscreen_element_size;
            offset = offset + ((raw_offset - offset) / 8);

            //Getting current action by evaluating the raw offset.
            if (current_actions.length > 0)
            {
                var current_action_index = -1;
                current_action_index = Math.floor((Math.abs(offset) - (Math.abs(offset) > 10 ? 10 : 0)) / action_element_size);
                current_action_index = Math.min(current_action_index, current_actions.length-1);

                if (threshold_changed == true || model.previous_action != current_actions[current_action_index])
                {
                    var current_action = current_actions[current_action_index],
                        current_action_title = "",
                        current_action_class_name = "";

                    if (current_action instanceof HTMLElement)
                    {
                        current_action_title = current_action.getAttribute("data-name");
                    }
                    else
                    {
                        current_action_title = current_action;
                    }

                    current_action_class_name = current_action_title.replace(/\W+/g, "-").toLowerCase();

                    if (model.has_threshold == true)
                    {  
                        model.current_attachment = attachment;
                        model.current_action = current_actions[current_action_index];  

                        ui.offscreen.attr("class", "reveal-offscreen reveal-offscreen-" + attachment);
                        ui.offscreen.addClass(defaults.action_css_prefix + current_action_class_name);
                    }
                    else
                    {
                        model.current_attachment = null;
                        model.current_action = null;

                        ui.offscreen.attr("class", "reveal-offscreen reveal-offscreen-" + attachment);
                    }
                    
                    //Setting label's text
                    ui.label.contents().remove();
                    if (current_action instanceof HTMLElement)
                    {
                        ui.label.append(current_action);
                    }
                    else
                    {
                        ui.label.text(current_action_title);
                    }
                } 
               
                ui.offscreen.css( defaults.orientation == "h" 
                                    ? { "width" : Math.abs(offset) } 
                                    : { "height" : Math.abs(offset) } );


                model.previous_action = current_actions[current_action_index];
            }
            else
            {
                ui.offscreen.css( defaults.orientation == "h" ? { "width" : 0 } 
                                                              : { "height" : 0 } );
            }

            //Rendering position of wrapper on-screen
            ui.wrapper.css(defaults.orientation == "h" ? "left" : "top", -offset);
        }});
    }

    $.fn.revealActions = function()
    {
        var args = arguments;

        return this.each(function() 
        {
            appendRevealActions.apply(this, args);
        });
    }

})(jQuery);